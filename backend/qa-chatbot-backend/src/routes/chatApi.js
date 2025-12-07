const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs-extra');
const dbService = require('../services/dbService');
const ragService = require('../services/ragService');
const memoryService = require('../services/memoryService');
const clusterService = require('../services/clusterService');
const llmService = require('../services/llmService');
const logger = require('../../../shared/utils/logger');
const config = require('../config');

const router = express.Router();

// ============================================
// API 文档根路径
// GET /api
// ============================================
router.get('/', (req, res) => {
  res.json({
    name: 'QA Chatbot Backend API',
    version: '1.0.0',
    description: '基于 LangChain.js 的 RAG 问答机器人后端服务 API',
    endpoints: [
      {
        method: 'GET',
        path: '/api',
        description: 'API 文档首页'
      },
      {
        method: 'GET',
        path: '/api/next-ids',
        description: '获取全局唯一会话ID和消息ID',
        request: {},
        response: {
          next_session_id: 'number',
          next_message_id: 'number'
        }
      },
      {
        method: 'GET',
        path: '/api/get-chat-history',
        description: '获取所有可见会话列表（仅包含会话信息，不包含消息）',
        request: {},
        response: {
          sessions: 'Array<Session>'
        }
      },
      {
        method: 'GET',
        path: '/api/get-chat-history/:session_id',
        description: '获取指定会话的历史消息（支持分页）',
        request: {
          session_id: 'number (URL路径参数)',
          limit: 'number (可选，默认50，最大100)',
          before_message_id: 'number (可选，用于加载更早的消息)'
        },
        response: {
          session: 'SessionInfo',
          messages: 'Array<Message>',
          pagination: 'PaginationInfo'
        }
      },
      {
        method: 'POST',
        path: '/api/chat',
        description: '发送消息并获取AI回复。支持两种方式：1) 传入 session_id 和 message_id（需先调用 /api/next-ids）；2) 不传 ID，后端自动生成',
        request: {
          session_id: 'number (可选，不传则自动生成)',
          message_id: 'number (可选，不传则自动生成)',
          content: 'string (必填)',
          attachments: 'file[] (可选)'
        },
        response: {
          session: 'SessionInfo (包含实际使用的 session_id)',
          user_message: 'UserMessage (包含实际使用的 message_id)',
          ai_message: 'AIMessage'
        }
      },
      {
        method: 'DELETE',
        path: '/api/del-chat-session/:session_id',
        description: '软删除指定会话',
        request: {
          session_id: 'number (URL路径参数)'
        },
        response: {
          success: 'boolean',
          deleted_session_id: 'number',
          error: 'string'
        }
      },
      {
        method: 'PUT',
        path: '/api/rename-chat-session/:session_id',
        description: '重命名指定会话',
        request: {
          session_id: 'number (URL路径参数)',
          title: 'string (请求体，新标题，最大长度100字符)'
        },
        response: {
          success: 'boolean',
          session_id: 'number',
          title: 'string',
          error: 'string'
        }
      }
    ],
    health_check: '/health',
    base_url: `http://${req.get('host')}/api`
  });
});

// ============================================
// 接口1: 获取全局唯一ID
// GET /api/next-ids
// ============================================
router.get('/next-ids', async (req, res) => {
  try {
    const nextSessionId = await dbService.getNextSessionId();
    const nextMessageId = await dbService.getNextMessageId();

    res.json({
      next_session_id: nextSessionId,
      next_message_id: nextMessageId
    });
  } catch (error) {
    logger.error('获取ID失败', { error: error.message });
    res.status(500).json({
      error: '获取ID失败',
      message: error.message
    });
  }
});

// ============================================
// 接口2: 获取所有会话列表（仅包含会话信息，不包含消息）
// GET /api/get-chat-history
// ============================================
router.get('/get-chat-history', async (req, res) => {
  try {
    const sessions = await dbService.getAllSessions();
    logger.info('获取会话列表', { count: sessions.length });
    
    // 只返回会话基本信息，不包含消息
    const sessionList = sessions.map(session => ({
      session_id: session.session_id,
      title: session.title || '新对话',
      created_at: session.created_at,
      updated_at: session.updated_at || session.created_at,
      message_count: session.message_count || 0,
      last_message_at: session.last_message_at || session.updated_at || session.created_at
    }));

    logger.info('返回会话列表', { count: sessionList.length });
    res.json({
      sessions: sessionList
    });
  } catch (error) {
    logger.error('获取会话列表失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      error: '获取会话列表失败',
      message: error.message
    });
  }
});

// ============================================
// 接口3: 获取指定会话的历史消息（支持分页）
// GET /api/get-chat-history/:session_id?limit=50&before_message_id=5000
// ============================================
router.get('/get-chat-history/:session_id', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.session_id);
    
    // ========== 1. 参数解析和验证 ==========
    const DEFAULT_LIMIT = 50;
    const MAX_LIMIT = 100;
    const limit = Math.min(
      Math.max(1, parseInt(req.query.limit) || DEFAULT_LIMIT),
      MAX_LIMIT
    );
    
    const beforeMessageId = req.query.before_message_id 
      ? parseInt(req.query.before_message_id) 
      : null;
    
    // 验证 session_id
    if (isNaN(sessionId)) {
      return res.status(400).json({
        error: '参数错误',
        message: '无效的会话ID'
      });
    }
    
    // ========== 2. 验证 session 是否存在 ==========
    const session = await dbService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: '会话不存在'
      });
    }
    
    // ========== 3. 获取消息总数 ==========
    const [countResult] = await dbService.pool.execute(
      `SELECT COUNT(*) as total FROM Message WHERE session_id = ?`,
      [sessionId]
    );
    const total = countResult[0].total;
    
    // ========== 4. 构建查询 ==========
    let sql, params;
    
    if (beforeMessageId) {
      // 加载指定消息之前的消息（加载更早的历史）
      // 先获取 beforeMessageId 对应的 sequence_num
      const [beforeMsgResult] = await dbService.pool.execute(
        `SELECT sequence_num FROM Message WHERE message_id = ? AND session_id = ?`,
        [beforeMessageId, sessionId]
      );
      
        if (beforeMsgResult.length === 0) {
          return res.status(404).json({
            error: '指定的消息不存在'
          });
        }
        
        const beforeSequenceNum = beforeMsgResult[0].sequence_num;
        
        // MySQL2 中 LIMIT 不能使用占位符，需要直接拼接（limit 已经验证过是整数）
        sql = `
          SELECT * FROM Message 
          WHERE session_id = ? 
          AND sequence_num < ?
          ORDER BY sequence_num DESC 
          LIMIT ${limit}
        `;
        params = [sessionId, beforeSequenceNum];
      } else {
        // 默认：返回最新的消息
        // MySQL2 中 LIMIT 不能使用占位符，需要直接拼接（limit 已经验证过是整数）
        sql = `
          SELECT * FROM Message 
          WHERE session_id = ? 
          ORDER BY sequence_num DESC 
          LIMIT ${limit}
        `;
        params = [sessionId];
      }
    
    logger.info('执行SQL查询', { sql, params: params.map(p => typeof p === 'number' ? p : '?') });
    const [messages] = await dbService.pool.execute(sql, params);
    
    // 如果是从最新开始查询，需要反转顺序（保持时间顺序）
    if (!beforeMessageId) {
      messages.reverse();
    }
    
    // ========== 5. 批量获取引用和知识库信息 ==========
    const messageIds = messages.map(m => m.message_id);
    const citationsMap = await dbService.getCitationsByMessageIds(messageIds);
    
    // 收集所有知识库ID
    const knowledgeIds = [];
    for (const citations of citationsMap.values()) {
      for (const citation of citations) {
        if (citation.knowledge_id && !knowledgeIds.includes(citation.knowledge_id)) {
          knowledgeIds.push(citation.knowledge_id);
        }
      }
    }
    const knowledgeMap = await dbService.getKnowledgeByIds(knowledgeIds);
    
    // ========== 6. 格式化消息 ==========
    // 按 knowledge_id 分组 citations，收集所有页码和得分
    // 使用 Map 结构：key: knowledge_id, value: Map<page, {totalScore, count, maxScore}>
    const knowledgeCitationsMap = new Map(); // key: knowledge_id, value: Map<page, {totalScore, count, maxScore}>
    
    for (const [messageId, citations] of citationsMap.entries()) {
      for (const citation of citations) {
        const knowledgeId = citation.knowledge_id;
        if (!knowledgeId) continue;
        
        // 提取页码
        let page = null;
        const metadata = citation.chunk_metadata || {};
        if (metadata.page !== undefined && metadata.page !== null) {
          page = parseInt(metadata.page);
          if (isNaN(page) || page < 1) page = null;
        } else if (metadata.pageNumber !== undefined && metadata.pageNumber !== null) {
          page = parseInt(metadata.pageNumber);
          if (isNaN(page) || page < 1) page = null;
        } else if (metadata.page_num !== undefined && metadata.page_num !== null) {
          page = parseInt(metadata.page_num);
          if (isNaN(page) || page < 1) page = null;
        }
        
        if (page !== null) {
          if (!knowledgeCitationsMap.has(knowledgeId)) {
            knowledgeCitationsMap.set(knowledgeId, new Map());
          }
          const pageMap = knowledgeCitationsMap.get(knowledgeId);
          const score = citation.score || 0;
          
          // 如果该页码已存在，累加权重；否则创建新记录
          if (pageMap.has(page)) {
            const pageInfo = pageMap.get(page);
            pageInfo.totalScore += score; // 累加总权重
            pageInfo.count += 1; // 增加引用次数
            pageInfo.maxScore = Math.max(pageInfo.maxScore, score); // 更新最大权重
          } else {
            pageMap.set(page, {
              totalScore: score, // 总权重（所有引用的得分之和）
              count: 1, // 引用次数
              maxScore: score // 最大权重（用于向后兼容）
            });
          }
        }
      }
    }
    
    // 转换为数组格式并按总权重排序
    // 权重计算公式：总权重 = 所有相同页码的得分之和
    // 排序时优先按总权重，总权重相同时按最大权重，再相同时按页码
    for (const [knowledgeId, pageMap] of knowledgeCitationsMap.entries()) {
      const pages = Array.from(pageMap.entries()).map(([page, info]) => ({
        page,
        score: info.totalScore, // 使用总权重作为排序依据
        totalScore: info.totalScore, // 总权重
        count: info.count, // 引用次数
        maxScore: info.maxScore // 最大权重（用于向后兼容）
      }));
      
      // 按总权重降序排序，总权重相同时按最大权重降序，再相同时按页码升序
      pages.sort((a, b) => {
        if (Math.abs(a.totalScore - b.totalScore) > 0.001) {
          return b.totalScore - a.totalScore; // 总权重降序
        }
        if (Math.abs(a.maxScore - b.maxScore) > 0.001) {
          return b.maxScore - a.maxScore; // 最大权重降序
        }
        return a.page - b.page; // 页码升序
      });
      
      // 更新 Map，存储排序后的数组
      knowledgeCitationsMap.set(knowledgeId, pages);
    }
    
    const formattedMessages = messages.map(msg => {
      const citations = citationsMap.get(msg.message_id) || [];
      // 按 knowledge_id 分组，收集该消息的所有引用
      const refMap = new Map();
      
      for (const citation of citations) {
        const knowledgeId = citation.knowledge_id;
        if (!knowledgeId) continue;
        
        const knowledge = knowledgeMap.get(knowledgeId);
        if (!knowledge) continue;
        
        // 提取页码
        let page = null;
        const metadata = citation.chunk_metadata || {};
        if (metadata.page !== undefined && metadata.page !== null) {
          page = parseInt(metadata.page);
          if (isNaN(page) || page < 1) page = null;
        } else if (metadata.pageNumber !== undefined && metadata.pageNumber !== null) {
          page = parseInt(metadata.pageNumber);
          if (isNaN(page) || page < 1) page = null;
        } else if (metadata.page_num !== undefined && metadata.page_num !== null) {
          page = parseInt(metadata.page_num);
          if (isNaN(page) || page < 1) page = null;
        }
        
        if (!refMap.has(knowledgeId)) {
          const allPages = knowledgeCitationsMap.get(knowledgeId) || [];
          refMap.set(knowledgeId, {
            knowledge_id: knowledge.knowledge_id,
            title: knowledge.title,
            type: getFileType(knowledge.type),
            file_url: knowledge.file_url || '',
            page: allPages.length > 0 ? allPages[0].page : undefined, // 总权重最高的页码
            pages: allPages.length > 0 ? allPages.map(p => ({
              page: p.page,
              score: p.totalScore, // 返回总权重
              totalScore: p.totalScore, // 总权重
              count: p.count, // 引用次数
              maxScore: p.maxScore // 最大权重
            })) : undefined, // 所有页码，按总权重排序
            score: allPages.length > 0 ? allPages[0].totalScore : undefined, // 使用总权重
            chunks: [] // 存储所有chunk信息，用于句子匹配
          });
        }
        
        // 添加chunk信息（包含chunk_text和页码）
        const ref = refMap.get(knowledgeId);
        if (citation.chunk_text && page !== null) {
          ref.chunks.push({
            text: citation.chunk_text,
            page: page,
            score: citation.score || 0
          });
        }
      }
      
      const references = Array.from(refMap.values());
      
      return {
        message_id: msg.message_id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
        sequence_num: msg.sequence_num,
        references: references
      };
    });
    
    // ========== 7. 判断是否还有更多数据 ==========
    const earliestMessage = messages.length > 0 ? messages[0] : null;
    const hasMoreBefore = earliestMessage 
      ? earliestMessage.sequence_num > 1 
      : false;
    
    // ========== 8. 返回响应 ==========
    res.json({
      session: {
        session_id: session.session_id,
        title: session.title,
        created_at: session.created_at
      },
      messages: formattedMessages,
      pagination: {
        limit: limit,
        total: total,
        returned: messages.length,
        hasMoreBefore: hasMoreBefore,
        earliestMessageId: earliestMessage?.message_id || null,
        earliestSequenceNum: earliestMessage?.sequence_num || null
      }
    });
    
  } catch (error) {
    logger.error('获取会话历史失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      error: '获取会话历史失败',
      message: error.message
    });
  }
});

// ============================================
// 接口4: 发送消息并获取AI回复
// POST /api/chat
// ============================================
router.post('/chat', async (req, res) => {
  try {
    const { session_id, message_id, content, message, history } = req.body;
    
    // 调试日志
    logger.info('收到聊天请求', {
      hasContent: !!content,
      hasMessage: !!message,
      contentLength: content?.length || 0,
      messageLength: message?.length || 0,
      session_id,
      historyLength: history?.length || 0
    });
    
    // 兼容两种请求格式：content 或 message
    const actualContent = content || message;

    // 只验证 content 是必填的，session_id 和 message_id 可选
    if (!actualContent || (typeof actualContent === 'string' && actualContent.trim().length === 0)) {
      logger.warn('请求参数验证失败', { content, message, body: req.body });
      return res.status(400).json({
        error: '参数不完整',
        message: 'content 或 message 为必填项，且不能为空字符串，session_id 和 message_id 可选（不传则自动生成）'
      });
    }
    
    // 转换 history 格式（如果提供）
    let chatHistory = [];
    if (history && Array.isArray(history)) {
      chatHistory = history.map(h => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content
      }));
    }

    // ===== 支持两种方式：传入 ID 或自动生成 =====
    
    // 1. 处理 session_id：如果未传或格式不正确，自动生成
    // 前端可能发送字符串格式的 session_id（如 "session-123456"），需要转换为数字或忽略
    let actualSessionId = null;
    if (session_id) {
      // 如果是数字字符串，转换为数字
      const parsedId = parseInt(session_id, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        actualSessionId = parsedId;
      } else if (typeof session_id === 'number' && session_id > 0) {
        actualSessionId = session_id;
      }
      // 如果是字符串格式（如 "session-123456"），忽略它，让后端自动生成
      // 前端使用临时 session_id，后端会生成真实的数字 ID
    }
    let isNewSession = false;

    if (!actualSessionId) {
      // 未传入有效的 session_id，自动生成
      actualSessionId = await dbService.getNextSessionId();
      isNewSession = true;
      logger.info('自动生成 session_id', { session_id: actualSessionId, originalSessionId: session_id });
    } else {
      // 传入了有效的 session_id，检查是否存在
      const existingSession = await dbService.getSessionById(actualSessionId);
      isNewSession = !existingSession;
      if (isNewSession) {
        logger.info('session_id 不存在，将创建新会话', { session_id: actualSessionId });
      }
    }

    // 2. 创建或获取会话
    let session;
    if (isNewSession) {
      // 创建新会话，标题先使用首条消息
      const title = actualContent.length > 50 ? actualContent.substring(0, 50) + '...' : actualContent;
      await dbService.createSession(actualSessionId, title);
      session = await dbService.getSessionById(actualSessionId);
    } else {
      // 会话已存在，获取会话信息
      session = await dbService.getSessionById(actualSessionId);
      // 更新会话标题（如果还没有标题）
      if (!session.title && actualContent.length <= 50) {
        await dbService.updateSession(actualSessionId, { title: actualContent });
        session.title = actualContent;
      }
    }

    // 3. 处理 message_id：如果未传，自动生成
    let actualMessageId = message_id;
    if (!actualMessageId) {
      actualMessageId = await dbService.getNextMessageId();
      logger.info('自动生成 message_id', { message_id: actualMessageId });
    }

    // 4. 获取当前会话的消息数量，确定 sequence_num
    const existingMessages = await dbService.getMessagesBySessionId(actualSessionId);
    const sequenceNum = existingMessages.length + 1;

    // 5. 保存用户消息
    const questionHash = crypto
      .createHash('md5')
      .update(actualContent.trim().toLowerCase())
      .digest('hex');
    
    const tokenCount = memoryService.estimateTokens(actualContent);
    
    await dbService.createMessage({
      message_id: actualMessageId,  // 使用实际的消息ID（传入的或生成的）
      session_id: actualSessionId,   // 使用实际的会话ID（传入的或生成的）
      role: 'user',
      content: actualContent,
      sequence_num: sequenceNum,
      token_count: tokenCount,
      question_hash: questionHash
    });

    // 5.5. 问题分类：判断是日常问答还是专业问题（用于决定是否聚类）
    let questionClassification = await ragService.classifyQuestion(actualContent);
    let isProfessional = questionClassification.isProfessional;
    
    // 5.6. 仅对专业问题进行聚类和统计（日常会话不进行聚类）
    if (isProfessional) {
      try {
        await clusterService.clusterQuestion(actualContent, actualMessageId, actualSessionId);
      } catch (error) {
        // 聚类失败不影响主流程，只记录错误
        logger.warn('问题聚类失败（不影响主流程）', {
          error: error.message,
          messageId: actualMessageId,
          question: actualContent.substring(0, 50)
        });
      }
    } else {
      logger.info('日常问答，跳过问题聚类', { 
        question: actualContent.substring(0, 50) 
      });
    }

    // 6. 加载历史消息到 Memory（如果需要）
    await memoryService.loadHistoryFromDB(actualSessionId);

    // 7. 添加用户消息到 Memory
    memoryService.addMessage(actualSessionId, 'user', actualContent);

    // 8. 检查是否请求流式响应（通过 Accept 头或 query 参数）
    const acceptStream = req.headers.accept?.includes('text/event-stream') || req.query.stream === 'true';
    
    // 如果前端提供了 history，使用它；否则使用 memory 中的历史
    const finalChatHistory = chatHistory.length > 0 
      ? chatHistory 
      : memoryService.getChatHistory(actualSessionId);
    
    let ragResult;
    let streamStarted = false;
    
    if (acceptStream) {
      // 流式响应模式：实时转发 AI 生成的 token
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // 发送开始事件
      res.write(`data: ${JSON.stringify({ type: 'start', session_id: actualSessionId })}\n\n`);
      streamStarted = true;
      
      try {
        // 收集完整答案用于后续保存
        let fullAnswer = '';
        
        // 流式调用 RAG 服务，实时转发 token
        ragResult = await ragService.queryStream(actualContent, finalChatHistory, (token) => {
          fullAnswer += token;
          // 实时转发给前端
          if (!res.headersSent || res.writable) {
            res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
          }
        });
        
        // 确保使用收集到的完整答案
        ragResult.answer = fullAnswer;
      } catch (streamError) {
        // 流式响应中的错误：通过流式事件发送错误
        logger.error('RAG 流式查询失败', { error: streamError.message, stack: streamError.stack });
        if (!res.headersSent || res.writable) {
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            message: streamError.message || '处理请求时发生错误'
          })}\n\n`);
          res.end();
        }
        return; // 提前返回，不再执行后续代码
      }
    } else {
      // 非流式响应模式：等待完整结果
      ragResult = await ragService.query(actualContent, finalChatHistory);
    }

    // 9. 生成 AI 消息 ID
    const aiMessageId = await dbService.getNextMessageId();
    const aiSequenceNum = sequenceNum + 1;
    const aiTokenCount = memoryService.estimateTokens(ragResult.answer);

    // 10. 保存 AI 消息
    await dbService.createMessage({
      message_id: aiMessageId,
      session_id: actualSessionId,  // 使用实际的会话ID
      role: ragResult.role,
      content: ragResult.answer,
      sequence_num: aiSequenceNum,
      token_count: aiTokenCount
    });

    // 11. 使用之前的问题分类结果（已在步骤 5.5 中完成）
    // 注意：RAG 查询时也会进行问题分类，但这里使用用户消息的分类结果
    
    // 12. 保存引用关系（仅在专业问题且有引用时）
    if (isProfessional && ragResult.hasRelevantDocs && ragResult.references && ragResult.references.length > 0) {
      // 获取向量检索结果用于保存引用详情
      const documents = await ragService.retrieveDocuments(actualContent);
      
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const knowledgeId = doc.metadata?.knowledgeId;
        
        if (knowledgeId) {
          await dbService.createMessageCitation({
            message_id: aiMessageId,
            vector_id: doc.id,
            knowledge_id: parseInt(knowledgeId),
            chunk_text: doc.text.substring(0, 500), // 保存前500字符
            chunk_metadata: doc.metadata || {},
            score: doc.score,
            rank_order: i + 1
          });
        }
      }
    } else if (isProfessional && (!ragResult.hasRelevantDocs || !ragResult.references || ragResult.references.length === 0)) {
      // 零命中问题，仅在专业问题且零命中时保存到 ZeroHitQuestion 表
      // 日常问题不保存到零命中表
      await dbService.saveZeroHitQuestion({
        message_id: actualMessageId,  // 使用实际的消息ID
        session_id: actualSessionId,   // 使用实际的会话ID
        question_text: actualContent,
        question_hash: questionHash
      });
    }

    // 12. 添加 AI 消息到 Memory
    memoryService.addMessage(actualSessionId, ragResult.role, ragResult.answer);

    // 13. 检查是否需要生成摘要
    await memoryService.checkAndSummarize(actualSessionId);

    // 14. 返回响应
    if (acceptStream) {
      // 流式响应：发送完成事件
      if (res.writable && !res.destroyed) {
        res.write(`data: ${JSON.stringify({ 
          type: 'done', 
          content: ragResult.answer,
          references: ragResult.references || []
        })}\n\n`);
        res.end();
      }
    } else {
      // 普通 JSON 响应
      res.json({
        session: {
          session_id: session.session_id,  // 返回实际使用的 session_id
          title: session.title || actualContent.substring(0, 50),
          created_at: session.created_at
        },
        user_message: {
          message_id: actualMessageId,  // 返回实际使用的 message_id
          created_at: new Date().toISOString()
        },
        ai_message: {
          message_id: aiMessageId,
          role: ragResult.role,
          content: ragResult.answer,
          references: ragResult.references || []
        }
      });
    }

  } catch (error) {
    logger.error('处理聊天请求失败', { error: error.message, stack: error.stack });
    
    // 如果流式响应已经开始，通过流式事件发送错误
    const acceptStream = req.headers.accept?.includes('text/event-stream') || req.query.stream === 'true';
    if (acceptStream && res.headersSent) {
      // 流式响应已开始，通过流式事件发送错误
      if (res.writable) {
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          message: error.message || '处理请求时发生错误'
        })}\n\n`);
        res.end();
      }
    } else {
      // 普通响应或流式响应未开始，发送 JSON 错误响应
      if (!res.headersSent) {
        res.status(500).json({
          error: '处理聊天请求失败',
          message: error.message
        });
      }
    }
  }
});

// ============================================
// 接口5: 删除单个会话
// DELETE /api/del-chat-session/:session_id
// ============================================
router.delete('/del-chat-session/:session_id', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.session_id);
    
    if (isNaN(sessionId)) {
      return res.status(400).json({
        success: false,
        deleted_session_id: sessionId,
        error: '无效的会话ID'
      });
    }
    
    const success = await dbService.softDeleteSession(sessionId);
    
    if (success) {
      // 清除 Memory
      memoryService.clearMemory(sessionId);
      
      res.json({
        success: true,
        deleted_session_id: sessionId,
        error: 'ok'
      });
    } else {
      res.status(404).json({
        success: false,
        deleted_session_id: sessionId,
        error: '会话不存在或已被删除'
      });
    }
  } catch (error) {
    logger.error('删除会话失败', { error: error.message });
    res.status(500).json({
      success: false,
      deleted_session_id: req.params.session_id,
      error: error.message
    });
  }
});

// ============================================
// 接口5.5: 重命名会话
// PUT /api/rename-chat-session/:session_id
// ============================================
router.put('/rename-chat-session/:session_id', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.session_id);
    const { title } = req.body;
    
    // 验证 session_id
    if (isNaN(sessionId)) {
      return res.status(400).json({
        success: false,
        error: '无效的会话ID'
      });
    }
    
    // 验证 title
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '标题不能为空'
      });
    }
    
    // 限制标题长度
    const trimmedTitle = title.trim();
    if (trimmedTitle.length > 100) {
      return res.status(400).json({
        success: false,
        error: '标题长度不能超过100个字符'
      });
    }
    
    // 检查会话是否存在
    const session = await dbService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: '会话不存在'
      });
    }
    
    // 更新会话标题
    await dbService.updateSession(sessionId, { title: trimmedTitle });
    
    logger.info('重命名会话成功', { sessionId, title: trimmedTitle });
    
    res.json({
      success: true,
      session_id: sessionId,
      title: trimmedTitle
    });
  } catch (error) {
    logger.error('重命名会话失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 接口6: 文件预览（直接实现，不依赖 kb-backend）
// GET /api/file/:knowledgeId
// ============================================
router.get('/file/:knowledgeId', async (req, res) => {
  try {
    const knowledgeId = parseInt(req.params.knowledgeId);
    if (isNaN(knowledgeId)) {
      return res.status(400).json({ message: '无效的knowledge_id' });
    }

    // 从数据库获取知识库信息
    const knowledge = await dbService.getKnowledgeById(knowledgeId);
    if (!knowledge) {
      return res.status(404).json({ message: '知识记录不存在' });
    }

    // 如果是JSON类型，返回JSON内容
    if (knowledge.type === 'json') {
      if (!knowledge.content) {
        return res.status(404).json({ message: 'JSON内容不存在' });
      }
      
      // 注意：从数据库读取的 content 可能是 JSON 字符串，需要解析
      let jsonContent;
      try {
        jsonContent = typeof knowledge.content === 'string' 
          ? JSON.parse(knowledge.content) 
          : knowledge.content;
      } catch (error) {
        return res.status(500).json({ 
          message: 'JSON内容解析失败', 
          error: error.message 
        });
      }
      
      // 返回格式化的JSON响应
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.json({
        knowledge_id: knowledge.knowledge_id,
        type: 'json',
        title: knowledge.title,
        content: jsonContent,
        status: knowledge.status,
        business: knowledge.business || '',
        scene: knowledge.scene || '',
        created_at: knowledge.created_at,
        updated_at: knowledge.updated_at
      });
    }

    // 从file_url中提取文件路径
    if (!knowledge.file_url) {
      return res.status(404).json({ message: '文件URL不存在' });
    }

    let filePath;
    
    // 判断 file_url 是绝对路径还是相对路径
    if (path.isAbsolute(knowledge.file_url)) {
      // 如果是绝对路径，直接使用
      filePath = knowledge.file_url;
      logger.info('使用绝对路径', { filePath, knowledgeId });
    } else {
      // 如果是相对路径（如 /uploads/xxx.pdf），转换为绝对路径
      let relativePath = knowledge.file_url.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
      filePath = path.join(config.uploadDir, relativePath);
      logger.info('使用相对路径转换为绝对路径', { filePath, relativePath, uploadDir: config.uploadDir, knowledgeId });
    }

    // 检查文件是否存在
    if (!await fs.pathExists(filePath)) {
      // 如果直接路径不存在，尝试在 uploads 目录下查找匹配的文件名
      const filenameFromUrl = path.basename(knowledge.file_url);
      try {
        // 确保 uploadDir 存在
        if (!await fs.pathExists(config.uploadDir)) {
          logger.error('上传目录不存在', { uploadDir: config.uploadDir });
          return res.status(500).json({ 
            message: '上传目录不存在',
            uploadDir: config.uploadDir
          });
        }
        
        const filesInUploadDir = await fs.readdir(config.uploadDir);
        const matchedFile = filesInUploadDir.find(f => {
          // 尝试匹配原始文件名或解码后的文件名
          return f === filenameFromUrl || decodeFilename(f) === filenameFromUrl;
        });
        
        if (matchedFile) {
          filePath = path.join(config.uploadDir, matchedFile);
          logger.info('通过文件名匹配找到文件', { matchedFile, original: knowledge.file_url, knowledgeId });
        } else {
          logger.warn('文件不存在', { 
            filePath, 
            file_url: knowledge.file_url,
            uploadDir: config.uploadDir,
            filesInDir: filesInUploadDir.length,
            knowledgeId 
          });
          return res.status(404).json({ 
            message: `文件不存在: ${knowledge.file_url}`,
            debug: {
              tried: filePath,
              file_url: knowledge.file_url,
              uploadDir: config.uploadDir
            }
          });
        }
      } catch (error) {
        logger.error('读取上传目录失败', { error: error.message, uploadDir: config.uploadDir });
        return res.status(500).json({ 
          message: '无法访问文件目录',
          error: error.message 
        });
      }
    }

    // 检查是否需要返回原始文件（raw=true）还是HTML包装页面
    const raw = req.query.raw === 'true' || req.query.raw === '1';
    const ext = path.extname(filePath).toLowerCase();
    
    // 如果请求原始文件，直接返回
    if (raw) {
      const contentTypeMap = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.txt': 'text/plain; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
        '.json': 'application/json; charset=utf-8'
      };
      
      res.setHeader('Content-Type', contentTypeMap[ext] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(knowledge.title)}"`);
      return res.sendFile(path.resolve(filePath));
    }
    
    // 默认返回HTML包装页面
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3002';
    
    // 从查询参数中提取页码（如果存在）
    const pageNumber = req.query.page ? parseInt(req.query.page, 10) : null;
    
    // 构建PDF URL
    let fileUrl = `${protocol}://${host}/api/file/${knowledgeId}?raw=true`;
    if (pageNumber) {
      fileUrl += `#page=${pageNumber}`;
    }
    
    const title = escapeHtml(knowledge.title || '文档查看');
    
    // 根据文件类型返回不同的HTML包装
    let html;
    if (ext === '.pdf') {
      // PDF预览：使用浏览器原生查看器，支持 #page=N 参数
      html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}${pageNumber ? ` - 第 ${pageNumber} 页` : ''}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #525252;
    }
    iframe, embed {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
  </style>
</head>
<body>
  <iframe src="${fileUrl}" type="application/pdf" width="100%" height="100%">
    <p>您的浏览器不支持PDF查看。请 <a href="${fileUrl}">下载文件</a> 查看。</p>
  </iframe>
</body>
</html>`;
    } else {
      // 其他文件类型提供下载链接
      html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      text-align: center;
      padding: 50px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      max-width: 500px;
      margin: 0 auto;
    }
    h1 {
      color: #333;
      margin-bottom: 20px;
    }
    a {
      display: inline-block;
      background: #007bff;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 4px;
      margin-top: 20px;
    }
    a:hover {
      background: #0056b3;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>此文件类型不支持在线预览，请下载后查看。</p>
    <a href="${fileUrl}">下载文件</a>
  </div>
</body>
</html>`;
    }
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (error) {
    logger.error('文件预览失败', { error: error.message, stack: error.stack });
    if (!res.headersSent) {
      res.status(500).json({ message: '文件预览失败', error: error.message });
    }
  }
});

// 辅助函数：HTML转义
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ============================================
// 辅助函数
// ============================================
function getFileType(type) {
  const typeMap = {
    'pdf': 'PDF',
    'docx': '富文本',
    'txt': '富文本',
    'md': '富文本',
    'json': '富文本'
  };
  return typeMap[type] || '富文本';
}

// 解码文件名（处理 URL 编码和 latin1 编码）
function decodeFilename(name = '') {
  if (!name) return '';
  
  try {
    // 方法1: 尝试 URL 解码（前端可能进行了 URL 编码）
    try {
      const urlDecoded = decodeURIComponent(name);
      if (urlDecoded !== name) {
        return urlDecoded;
      }
    } catch (e) {
      // 不是 URL 编码，继续尝试其他方法
    }
    
    // 方法2: 尝试从 latin1 解码（multer 在某些情况下使用 latin1）
    try {
      const latin1Decoded = Buffer.from(name, 'latin1').toString('utf8');
      if (latin1Decoded !== name && latin1Decoded.length > 0) {
        return latin1Decoded;
      }
    } catch (e) {
      // 解码失败，返回原名称
    }
    
    return name;
  } catch (error) {
    logger.warn('文件名解码失败', { name, error: error.message });
    return name;
  }
}

// ============================================
// 接口7: 获取可用的 LLM 模型列表
// GET /api/llm/models
// ============================================
router.get('/llm/models', async (req, res) => {
  try {
    const models = llmService.getAvailableModels();
    const current = llmService.getCurrentModel();
    
    res.json({
      models: models,
      current: current
    });
  } catch (error) {
    logger.error('获取模型列表失败', { error: error.message });
    res.status(500).json({
      error: '获取模型列表失败',
      message: error.message
    });
  }
});

// ============================================
// 接口8: 获取当前使用的 LLM 模型
// GET /api/llm/current
// ============================================
router.get('/llm/current', async (req, res) => {
  try {
    const current = llmService.getCurrentModel();
    res.json(current);
  } catch (error) {
    logger.error('获取当前模型失败', { error: error.message });
    res.status(500).json({
      error: '获取当前模型失败',
      message: error.message
    });
  }
});

// ============================================
// 接口9: 切换 LLM 模型
// POST /api/llm/switch
// ============================================
router.post('/llm/switch', async (req, res) => {
  try {
    const { provider, model } = req.body;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'provider 参数不能为空'
      });
    }
    
    // 切换模型
    const result = llmService.switchModel(provider, model);
    
    // 同时更新 RAG 和 Memory 服务
    ragService.switchModel(provider, model);
    memoryService.switchModel(provider, model);
    
    logger.info('模型切换成功', { provider, model: result.model });
    
    res.json({
      success: true,
      provider: result.provider,
      model: result.model
    });
  } catch (error) {
    logger.error('切换模型失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

