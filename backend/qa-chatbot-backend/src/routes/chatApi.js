const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const dbService = require('../services/dbService');
const ragService = require('../services/ragService');
const memoryService = require('../services/memoryService');
const clusterService = require('../services/clusterService');
const llmService = require('../services/llmService');
const logger = require('../../../shared/utils/logger');
const config = require('../config');
const {
  buildMultimodalMessage,
  extractTextFromMultimodalMessage,
  validateInput,
  generateImageInfo,
  generateAudioInfo,
  buildStorageContent,
  parseStorageContent
} = require('../utils/multimodalInputHandler');
const fileStorageService = require('../utils/fileStorageService');
const multimodalService = require('../services/multimodalService');
const fileParserService = require('../utils/fileParserService');

const router = express.Router();

// 配置multer用于文件上传（内存存储，不保存到磁盘）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    // 允许图片、音频和附件文件（PDF、Word、文本等）
    const allowedMimes = [
      // 图片
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      // 音频
      'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/m4a', 'audio/webm', 'audio/ogg',
      // 附件文件
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/markdown',
      'application/json'
    ];
    
    // 检查文件字段名，如果是attachment字段，允许更多类型
    if (file.fieldname === 'attachment') {
      // 附件字段：允许所有常见文档类型
      const attachmentMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/markdown',
        'application/json'
      ];
      if (attachmentMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        // 也允许通过扩展名判断
        const ext = require('path').extname(file.originalname).toLowerCase();
        const allowedExts = ['.pdf', '.doc', '.docx', '.txt', '.md', '.json', '.xls', '.xlsx'];
        if (allowedExts.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error(`不支持的附件文件类型: ${file.mimetype}，仅支持 PDF、Word、文本等文档`));
        }
      }
    } else if (file.fieldname === 'image') {
      // 图片字段：只允许图片类型
      const imageMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (imageMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('不支持的文件类型，图片字段仅支持图片文件'));
      }
    } else if (file.fieldname === 'audio') {
      // 音频字段：只允许音频类型
      const audioMimes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/m4a', 'audio/webm', 'audio/ogg'];
      if (audioMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('不支持的文件类型，音频字段仅支持音频文件'));
      }
    } else {
      cb(null, true); // 其他字段允许通过
    }
  }
});

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
      // 解析content，提取文本、图片、音频信息
      const parsedContent = parseStorageContent(msg.content);
      
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
      
      // 构建返回对象，包含解析后的内容
      // 移除图片、音频、附件解析后的内容（如 [图片内容：...]、[语音内容：...]、[附件文件内容：...]）
      let displayText = parsedContent.text || '';
      // 移除解析后的文件内容，避免在前端显示
      displayText = displayText.replace(/\[图片内容[：:][\s\S]*?\]/g, '');
      displayText = displayText.replace(/\[语音内容[：:][\s\S]*?\]/g, '');
      displayText = displayText.replace(/\[附件文件内容[：:][\s\S]*?\]/g, '');
      // 移除"总结文件:文件名 内容:"这样的格式（附件解析后的内容）
      displayText = displayText.replace(/总结文件[：:][^\n]*\s*内容[：:][\s\S]*?(?=\n\n|\n[A-Z]|$)/g, '');
      displayText = displayText.replace(/文件[：:][^\n]*\n内容[：:][\s\S]*?(?=\n\n|\n文件[：:]|$)/g, '');
      // 移除"文件：文件名\n内容：..."格式（更通用的匹配，匹配到段落结束或文档结束）
      displayText = displayText.replace(/文件[：:][^\n]+\n内容[：:][\s\S]*?(?=\n\n|$)/g, '');
      // 移除以"文件："开头，后面跟着文件名和"内容："的大段文本（包括单行和多行格式）
      displayText = displayText.replace(/文件[：:][^\n]+\s*内容[：:][\s\S]*?(?=\n\n|$)/g, '');
      // 清理多余的空白行
      displayText = displayText.replace(/\n\s*\n\s*\n/g, '\n\n');
      displayText = displayText.trim();
      
      const result = {
        message_id: msg.message_id,
        role: msg.role,
        content: displayText, // 文本内容（已移除解析后的文件内容）
        created_at: msg.created_at,
        sequence_num: msg.sequence_num,
        references: references
      };
      
      // 如果有图片，添加图片信息（支持URL对象或data URL字符串）
      if (parsedContent.image) {
        if (typeof parsedContent.image === 'string') {
          // 向后兼容：data URL字符串
          const imageMimeType = parsedContent.image.split(';')[0].split(':')[1] || 'image/jpeg';
          result.image = {
            name: 'image',
            type: imageMimeType,
            size: 0,
            dataUrl: parsedContent.image
          };
        } else if (typeof parsedContent.image === 'object' && parsedContent.image.url) {
          // 新格式：URL对象
          result.image = {
            name: parsedContent.image.originalName || 'image',
            type: parsedContent.image.mimeType || 'image/jpeg',
            size: parsedContent.image.size || 0,
            url: parsedContent.image.url,
            filename: parsedContent.image.filename
          };
        }
      }
      
      // 如果有音频，添加音频信息（支持URL对象或data URL字符串）
      if (parsedContent.audio) {
        logger.info('解析音频信息', {
          messageId: msg.message_id,
          audioType: typeof parsedContent.audio,
          audioKeys: typeof parsedContent.audio === 'object' ? Object.keys(parsedContent.audio) : [],
          hasUrl: typeof parsedContent.audio === 'object' ? !!parsedContent.audio.url : false,
          hasFilename: typeof parsedContent.audio === 'object' ? !!parsedContent.audio.filename : false
        });
        
        if (typeof parsedContent.audio === 'string') {
          // 向后兼容：data URL字符串
          const audioMimeType = parsedContent.audio.split(';')[0].split(':')[1] || 'audio/wav';
          result.audio = {
            name: 'audio',
            type: audioMimeType,
            size: 0,
            dataUrl: parsedContent.audio
          };
        } else if (typeof parsedContent.audio === 'object') {
          // 新格式：URL对象
          // 如果有url字段，直接使用；否则从filename构建URL
          let audioUrl = parsedContent.audio.url;
          if (!audioUrl && parsedContent.audio.filename) {
            // 从filename构建URL（相对路径）
            audioUrl = `/api/chat-files/${parsedContent.audio.filename}`;
          }
          
          result.audio = {
            name: parsedContent.audio.originalName || 'audio',
            type: parsedContent.audio.mimeType || 'audio/wav',
            size: parsedContent.audio.size || 0,
            url: audioUrl, // 确保有URL（从url字段或filename构建）
            filename: parsedContent.audio.filename
          };
          
          logger.info('音频信息已添加到结果', {
            messageId: msg.message_id,
            audioName: result.audio.name,
            audioUrl: result.audio.url,
            audioFilename: result.audio.filename
          });
        }
      } else {
        logger.info('消息没有音频信息', {
          messageId: msg.message_id,
          hasParsedContent: !!parsedContent,
          parsedContentKeys: Object.keys(parsedContent || {})
        });
      }
      
      // 如果有附件，添加附件信息
      if (parsedContent.attachments && parsedContent.attachments.length > 0) {
        result.attachments = parsedContent.attachments.map((att) => ({
          url: att.url,
          filename: att.filename,
          originalName: att.originalName,
          mimeType: att.mimeType,
          size: att.size
        }));
      }
      
      return result;
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
// 支持多模态：图片和语音文件上传
// ============================================
router.post('/chat', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
  { name: 'attachment', maxCount: 10 } // 保留原有的附件支持
]), (err, req, res, next) => {
  // 处理multer错误
  if (err) {
    logger.error('文件上传错误', { error: err.message });
    return res.status(400).json({
      error: '文件上传失败',
      message: err.message || '不支持的文件类型或文件过大'
    });
  }
  next();
}, async (req, res) => {
  try {
    const { session_id, message_id, content, message, history, parsedFiles } = req.body;
    const files = req.files || {};
    const imageFile = files.image && files.image[0];
    const audioFile = files.audio && files.audio[0];
    
    // 处理多模态输入 - 端到端模式：使用模块化工具函数
    const textContent = content || message || '';
    const attachmentFiles = files.attachment || [];
    
    // 检查是否使用已解析的文件信息
    const useParsedFiles = parsedFiles && (parsedFiles.image || parsedFiles.audio || (parsedFiles.attachments && parsedFiles.attachments.length > 0));
    
    // 调试日志
    logger.info('收到聊天请求', {
      hasContent: !!content,
      hasMessage: !!message,
      contentLength: content?.length || 0,
      messageLength: message?.length || 0,
      session_id,
      historyLength: history?.length || 0,
      hasImage: !!imageFile,
      hasAudio: !!audioFile,
      hasAttachments: attachmentFiles.length > 0,
      attachmentCount: attachmentFiles.length,
      attachmentNames: attachmentFiles.map(f => f.originalname || f.name || 'unknown'),
      allFileFields: Object.keys(files),
      useParsedFiles: useParsedFiles,
      hasParsedImage: !!parsedFiles?.image,
      hasParsedAudio: !!parsedFiles?.audio,
      hasParsedAttachments: parsedFiles?.attachments?.length > 0
    });
    
    // 验证输入（如果有文件或已解析的文件，也视为有效输入）
    const hasFilesInput = attachmentFiles.length > 0 || imageFile || audioFile || useParsedFiles;
    if (!validateInput({ text: textContent, imageFile, audioFile }) && !hasFilesInput) {
      logger.warn('请求参数验证失败', { content, message, body: req.body });
      return res.status(400).json({
        error: '参数不完整',
        message: '需要提供文本内容、图片、语音或附件文件中的至少一种，session_id 和 message_id 可选（不传则自动生成）'
      });
    }
    
    // 构建多模态消息（插槽式工具函数）
    // 注意：附件文件不在这里处理，它们会被保存到本地存储
    const multimodalMessage = buildMultimodalMessage({
      text: textContent,
      imageFile,
      audioFile,
      otherFiles: [] // 附件文件单独处理，不在这里传递
    });
    
    // 提取文本内容（用于问题分类和显示）
    const textForClassification = multimodalMessage 
      ? extractTextFromMultimodalMessage(multimodalMessage) 
      : textContent;
    
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
      // 创建新会话，标题先使用首条消息（使用文本内容）
      const title = textForClassification.length > 50 ? textForClassification.substring(0, 50) + '...' : textForClassification;
      await dbService.createSession(actualSessionId, title);
      session = await dbService.getSessionById(actualSessionId);
    } else {
      // 会话已存在，获取会话信息
      session = await dbService.getSessionById(actualSessionId);
      // 更新会话标题（如果还没有标题）
      if (!session.title && textForClassification.length <= 50) {
        await dbService.updateSession(actualSessionId, { title: textForClassification });
        session.title = textForClassification;
      }
    }

    // 3. 处理 message_id：如果未传，自动生成
    let actualMessageId = message_id;
    if (!actualMessageId) {
      actualMessageId = await dbService.getNextMessageId();
      logger.info('自动生成 message_id', { message_id: actualMessageId });
    }

    // 3.5. 处理文件：保存图片、音频和附件到本地存储
    const savedAttachments = [];
    let savedImageFile = null;
    let savedAudioFile = null;
    
    // 如果使用已解析的文件信息，直接从parsedFiles中获取文件信息
    if (useParsedFiles) {
      logger.info('使用已解析的文件信息', {
        hasImage: !!parsedFiles.image,
        hasAudio: !!parsedFiles.audio,
        attachmentCount: parsedFiles.attachments?.length || 0
      });
      
      // 处理已解析的图片
      if (parsedFiles.image) {
        savedImageFile = {
          url: parsedFiles.image.url,
          filename: parsedFiles.image.filename,
          originalName: parsedFiles.image.originalName,
          mimeType: parsedFiles.image.mimeType,
          size: parsedFiles.image.size,
          path: fileStorageService.getFilePath(parsedFiles.image.filename)
        };
      }
      
      // 处理已解析的音频
      if (parsedFiles.audio) {
        savedAudioFile = {
          url: parsedFiles.audio.url,
          filename: parsedFiles.audio.filename,
          originalName: parsedFiles.audio.originalName,
          mimeType: parsedFiles.audio.mimeType,
          size: parsedFiles.audio.size,
          path: fileStorageService.getFilePath(parsedFiles.audio.filename)
        };
      }
      
      // 处理已解析的附件
      if (parsedFiles.attachments && parsedFiles.attachments.length > 0) {
        for (const att of parsedFiles.attachments) {
          savedAttachments.push({
            url: att.url,
            filename: att.filename,
            originalName: att.originalName,
            mimeType: att.mimeType,
            size: att.size,
            path: fileStorageService.getFilePath(att.filename)
          });
        }
      }
    }
    
    // 保存图片文件（如果通过multer上传）
    if (imageFile && !useParsedFiles) {
      try {
        // 修复文件名编码问题（multer可能使用latin1编码）
        if (imageFile.originalname) {
          try {
            const decoded = Buffer.from(imageFile.originalname, 'latin1').toString('utf8');
            if (decoded !== imageFile.originalname) {
              imageFile.originalname = decoded;
            }
          } catch (e) {
            // 解码失败，使用原名称
          }
        }
        
        savedImageFile = await fileStorageService.saveFile(imageFile, actualMessageId);
        logger.info('图片文件已保存', { 
          messageId: actualMessageId, 
          filename: savedImageFile.filename,
          originalName: savedImageFile.originalName 
        });
      } catch (error) {
        logger.error('保存图片文件失败', { error: error.message, filename: imageFile.originalname });
        // 文件保存失败不影响主流程，但记录错误
      }
    }
    
    // 保存音频文件（如果通过multer上传）
    if (audioFile && !useParsedFiles) {
      try {
        // 修复文件名编码问题（multer可能使用latin1编码）
        if (audioFile.originalname) {
          try {
            const decoded = Buffer.from(audioFile.originalname, 'latin1').toString('utf8');
            if (decoded !== audioFile.originalname) {
              audioFile.originalname = decoded;
            }
          } catch (e) {
            // 解码失败，使用原名称
          }
        }
        
        savedAudioFile = await fileStorageService.saveFile(audioFile, actualMessageId);
        logger.info('音频文件已保存', { 
          messageId: actualMessageId, 
          filename: savedAudioFile.filename,
          originalName: savedAudioFile.originalName 
        });
      } catch (error) {
        logger.error('保存音频文件失败', { error: error.message, filename: audioFile.originalname });
        // 文件保存失败不影响主流程，但记录错误
      }
    }
    
    // 保存附件文件（如果通过multer上传）
    if (attachmentFiles.length > 0 && !useParsedFiles) {
      logger.info('开始保存附件文件', { 
        count: attachmentFiles.length,
        files: attachmentFiles.map(f => ({
          originalname: f.originalname,
          mimetype: f.mimetype,
          size: f.size,
          fieldname: f.fieldname
        }))
      });
      
      for (const file of attachmentFiles) {
        try {
          // 修复文件名编码问题（multer可能使用latin1编码）
          if (file.originalname) {
            try {
              const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
              if (decoded !== file.originalname) {
                file.originalname = decoded;
                logger.info('文件名编码已修复', { 
                  original: file.originalname, 
                  decoded 
                });
              }
            } catch (e) {
              // 解码失败，使用原名称
              logger.warn('文件名编码修复失败', { error: e.message });
            }
          }
          
          // 检查文件对象是否有效
          if (!file || !file.buffer) {
            logger.error('附件文件对象无效', { 
              file: file ? { originalname: file.originalname, mimetype: file.mimetype } : null 
            });
            continue;
          }
          
          logger.info('正在保存附件文件', { 
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            messageId: actualMessageId
          });
          
          const fileInfo = await fileStorageService.saveFile(file, actualMessageId);
          savedAttachments.push(fileInfo);
          logger.info('附件文件已保存成功', { 
            messageId: actualMessageId, 
            filename: fileInfo.filename,
            originalName: fileInfo.originalName,
            url: fileInfo.url,
            path: fileInfo.path
          });
        } catch (error) {
          logger.error('保存附件文件失败', { 
            error: error.message,
            stack: error.stack,
            filename: file?.originalname,
            messageId: actualMessageId
          });
          // 文件保存失败不影响主流程，但记录错误
        }
      }
      
      logger.info('附件文件保存完成', { 
        total: attachmentFiles.length,
        saved: savedAttachments.length,
        savedFiles: savedAttachments.map(f => f.originalName)
      });
    } else {
      logger.info('没有附件文件需要保存');
    }

    // 4. 获取当前会话的消息数量，确定 sequence_num
    const existingMessages = await dbService.getMessagesBySessionId(actualSessionId);
    const sequenceNum = existingMessages.length + 1;
    
    // 4.3. 判断是否有附件文件（仅附件文件，不包括图片和音频）
    // 注意：附件文件现在也走RAG路线，解析内容后添加提示词"商家知识库解读文档内容"，然后走RAG
    const hasAttachments = savedAttachments.length > 0;

    // 4.5. 构建存储格式的content（只存储URL引用，不存储base64数据）
    // 注意：text字段只保存用户输入的原始文本，不包含解析后的文件内容
    // 解析后的内容（extractedText）仅用于LLM处理，不保存到数据库的content字段
    const storageContent = buildStorageContent({
      text: textContent, // 只保存用户输入的原始文本，不包含extractedText
      attachments: savedAttachments,
      savedImageFile,
      savedAudioFile
    });

    // 5. 保存用户消息（使用存储格式的content，包含图片/音频base64和附件URL）
    const questionHash = crypto
      .createHash('md5')
      .update(textForClassification.trim().toLowerCase())
      .digest('hex');
    
    const tokenCount = memoryService.estimateTokens(textForClassification);
    
    await dbService.createMessage({
      message_id: actualMessageId,  // 使用实际的消息ID（传入的或生成的）
      session_id: actualSessionId,   // 使用实际的会话ID（传入的或生成的）
      role: 'user',
      content: storageContent, // 存储格式：JSON字符串（包含图片/音频/附件）或纯文本
      sequence_num: sequenceNum,
      token_count: tokenCount,
      question_hash: questionHash
    });

    // 5.4. 提取图片和音频信息（先提取信息，再用提示词模板）
    // 如果使用已解析的文件，直接使用extractedText；否则需要重新提取
    let extractedText = textForClassification;
    
    // 如果使用已解析的文件，将提取的文本拼接到extractedText中
    if (useParsedFiles) {
      const extractedTexts = [];
      const attachmentTexts = [];
      
      if (parsedFiles.image && parsedFiles.image.extractedText) {
        extractedTexts.push(parsedFiles.image.extractedText);
      }
      if (parsedFiles.audio && parsedFiles.audio.extractedText) {
        extractedTexts.push(parsedFiles.audio.extractedText);
      }
      if (parsedFiles.attachments && parsedFiles.attachments.length > 0) {
        // 附件文件的提取文本单独处理，需要添加提示词
        parsedFiles.attachments
          .filter(att => att.extractedText)
          .forEach(att => {
            attachmentTexts.push(att.extractedText);
          });
      }
      
      // 先拼接图片和音频的提取文本
      if (extractedTexts.length > 0) {
        extractedText = textContent
          ? `${textContent}\n\n${extractedTexts.join('\n\n')}`
          : extractedTexts.join('\n\n');
      } else {
        extractedText = textContent || '';
      }
      
      // 处理附件文件：如果用户没有输入文本，自动添加提示词
      if (attachmentTexts.length > 0) {
        const attachmentText = attachmentTexts.join('\n\n---\n\n');
        if (!extractedText || !extractedText.trim()) {
          // 用户没有输入文本，自动添加提示词
          extractedText = `用抖音商家知识库解读附件内容\n\n${attachmentText}`;
        } else {
          // 用户有输入文本，在文本后添加提示词和附件内容
          extractedText = `${extractedText}\n\n请使用商家知识库解读以下文档内容：\n\n${attachmentText}`;
        }
      }
    } else if (imageFile) {
      try {
        logger.info('开始提取图片信息', { filename: imageFile.originalname });
        const imageDescription = await multimodalService.understandImage(
          imageFile.buffer,
          textContent || '请详细描述这张图片的内容',
          'buffer'
        );
        // 图片描述：保持和文本输入一致的格式
        extractedText = textContent 
          ? `${textContent}\n\n[图片内容：${imageDescription}]`
          : `[图片内容：${imageDescription}]`;
        logger.info('图片信息提取成功', { descriptionLength: imageDescription.length });
      } catch (error) {
        logger.error('图片信息提取失败', { error: error.message });
        // 提取失败时，使用原始文本
        extractedText = textContent || '[图片上传失败，无法提取内容]';
      }
    } else if (audioFile) {
      try {
        // 确保文件名已正确解码
        const audioFileName = audioFile.originalname || 'audio';
        logger.info('开始提取音频信息', { filename: audioFileName });
        const audioFormat = audioFileName.split('.').pop() || 'webm';
        const audioText = await multimodalService.transcribeAudio(audioFile.buffer, audioFormat);
        // 音频文本：保持和文本输入一致的格式
        extractedText = textContent 
          ? `${textContent}\n\n[语音内容：${audioText}]`
          : `[语音内容：${audioText}]`;
        logger.info('音频信息提取成功', { textLength: audioText.length });
      } catch (error) {
        logger.error('音频信息提取失败', { error: error.message });
        // 提取失败时，使用原始文本
        extractedText = textContent || '[语音识别失败，无法提取内容]';
      }
    }
    
    // 5.4.1. 解析附件文件内容（如果有附件文件，解析后与用户输入拼接）
    // 如果使用已解析的文件，跳过这一步（内容已经在extractedText中）
    let parsedAttachmentContents = [];
    if (hasAttachments && savedAttachments.length > 0 && !useParsedFiles) {
      logger.info('开始解析附件文件内容', { 
        attachmentCount: savedAttachments.length,
        attachmentNames: savedAttachments.map(a => a.originalName)
      });
      
      for (const attachment of savedAttachments) {
        try {
          logger.info('解析附件文件', { filename: attachment.filename, originalName: attachment.originalName });
          const content = await fileParserService.parseFile({
            path: attachment.path || fileStorageService.getFilePath(attachment.filename),
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            originalName: attachment.originalName
          });
          parsedAttachmentContents.push({
            name: attachment.originalName,
            content: content
          });
          logger.info('附件文件解析成功', { filename: attachment.filename, contentLength: content.length });
        } catch (error) {
          logger.error('附件文件解析失败', { error: error.message, filename: attachment.filename });
          parsedAttachmentContents.push({
            name: attachment.originalName,
            content: `[文件解析失败：${error.message}]`
          });
        }
      }
      
      // 将解析后的附件内容拼接到extractedText中，并添加提示词
      if (parsedAttachmentContents.length > 0) {
        const attachmentText = parsedAttachmentContents.map(f => 
          `文件：${f.name}\n内容：\n${f.content}`
        ).join('\n\n---\n\n');
        
        // 如果用户没有输入文本，自动添加提示词：用抖音商家知识库解读附件内容
        // 如果用户有输入文本，则在文本后添加提示词
        if (!extractedText || !extractedText.trim()) {
          // 用户没有输入文本，自动添加提示词
          extractedText = `用抖音商家知识库解读附件内容\n\n${attachmentText}`;
        } else {
          // 用户有输入文本，在文本后添加提示词和附件内容
          extractedText = `${extractedText}\n\n请使用商家知识库解读以下文档内容：\n\n${attachmentText}`;
        }
      }
    }
    
    // 5.5. 问题分类：判断是日常问答还是专业问题（使用提取后的文本，包含附件内容）
    // 注意：即使有附件文件，也进行问题分类，然后走RAG路线
    let questionClassification = await ragService.classifyQuestion(extractedText);
    let isProfessional = questionClassification.isProfessional;
    
    // 5.6. 仅对专业问题进行聚类和统计（日常会话不进行聚类，有附件文件时也不聚类）
    // 注意：附件文件现在也走RAG，但附件文件的问题不进行聚类
    if (isProfessional && !hasAttachments) {
      try {
        await clusterService.clusterQuestion(textForClassification, actualMessageId, actualSessionId);
      } catch (error) {
        // 聚类失败不影响主流程，只记录错误
        logger.warn('问题聚类失败（不影响主流程）', {
          error: error.message,
          messageId: actualMessageId,
          question: textForClassification.substring(0, 50)
        });
      }
    } else {
      if (hasAttachments) {
        logger.info('有附件文件，跳过问题聚类', { 
          question: textForClassification.substring(0, 50),
          attachmentCount: savedAttachments.length
        });
      } else {
        logger.info('日常问答，跳过问题聚类', { 
          question: textForClassification.substring(0, 50) 
        });
      }
    }

    // 6. 加载历史消息到 Memory（如果需要）
    await memoryService.loadHistoryFromDB(actualSessionId);

    // 7. 添加用户消息到 Memory（使用提取后的文本内容）
    memoryService.addMessage(actualSessionId, 'user', extractedText);

    // 8. 检查是否请求流式响应（通过 Accept 头或 query 参数）
    const acceptStream = req.headers.accept?.includes('text/event-stream') || req.query.stream === 'true';
    
    // 如果前端提供了 history，使用它；否则使用 memory 中的历史
    const finalChatHistory = chatHistory.length > 0 
      ? chatHistory 
      : memoryService.getChatHistory(actualSessionId);
    
    // hasAttachments 已在前面定义（4.3节），这里直接使用
    
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
        
        // 根据问题分类决定是否走RAG（附件文件现在也走RAG路线）
        // 如果是专业问题，走RAG流程（包括附件文件、图片和音频的多模态RAG）
        // 如果是日常问题，直接调用大模型（不走RAG）
        if (isProfessional) {
          // 专业问题：走RAG流程（使用提取后的文本，包含附件内容）
          if (hasAttachments) {
            logger.info('检测到附件文件，解析内容后走RAG路线', { 
              attachmentCount: savedAttachments.length,
              attachmentNames: savedAttachments.map(a => a.originalName),
              question: extractedText.substring(0, 50)
            });
          } else {
            logger.info('识别为专业问题，使用知识库检索', { 
              question: extractedText.substring(0, 50)
            });
          }
          
          // 流式调用 RAG 服务，实时转发 token（使用提取后的文本，包含附件内容）
          ragResult = await ragService.queryStream(extractedText, finalChatHistory, (token) => {
            fullAnswer += token;
            // 实时转发给前端
            if (!res.headersSent || res.writable) {
              res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
            }
          });
          
          // 确保使用收集到的完整答案
          ragResult.answer = fullAnswer;
        } else {
          // 日常问题：直接调用大模型（不走RAG），使用商家运营助手提示词模板
          logger.info('识别为日常问答，直接调用大模型（不走RAG）', { 
            question: extractedText.substring(0, 50),
            hasAttachments: hasAttachments
          });
          
          // 使用商家运营助手提示词模板
          const chatPrompt = ragService.buildChatPrompt();
          const promptValue = await chatPrompt.invoke({
            chat_history: finalChatHistory,
            question: extractedText
          });
          
          const stream = await llmService.getLLM().stream(promptValue.toChatMessages());
          for await (const chunk of stream) {
            const content = chunk.content || '';
            if (content) {
              fullAnswer += content;
              if (res.writable && !res.destroyed) {
                res.write(`data: ${JSON.stringify({ type: 'token', content: content })}\n\n`);
              }
            }
          }
          
          ragResult = {
            answer: fullAnswer,
            role: 'AI',
            references: [],
            hasRelevantDocs: false
          };
        }
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
      // 根据问题分类决定是否走RAG（附件文件现在也走RAG路线）
      // 如果是专业问题，走RAG流程（包括附件文件、图片和音频的多模态RAG）
      // 如果是日常问题，直接调用大模型（不走RAG）
      if (isProfessional) {
        // 专业问题：走RAG流程（使用提取后的文本，包含附件内容）
        if (hasAttachments) {
          logger.info('检测到附件文件，解析内容后走RAG路线', { 
            attachmentCount: savedAttachments.length,
            attachmentNames: savedAttachments.map(a => a.originalName),
            question: extractedText.substring(0, 50)
          });
        } else {
          logger.info('识别为专业问题，使用知识库检索', { 
            question: extractedText.substring(0, 50)
          });
        }
        
        // 使用提取后的文本（包含附件内容）
        ragResult = await ragService.query(extractedText, finalChatHistory);
      } else {
        // 日常问题：直接调用大模型（不走RAG），使用商家运营助手提示词模板
        logger.info('识别为日常问答，直接调用大模型（不走RAG）', { 
          question: extractedText.substring(0, 50),
          hasAttachments: hasAttachments
        });
        
        // 使用商家运营助手提示词模板
        const chatPrompt = ragService.buildChatPrompt();
        const promptValue = await chatPrompt.invoke({
          chat_history: finalChatHistory,
          question: extractedText
        });
        
        const response = await llmService.getLLM().invoke(promptValue.toChatMessages());
        
        ragResult = {
          answer: response.content,
          role: 'AI',
          references: [],
          hasRelevantDocs: false
        };
      }
    }

    // 9. 生成 AI 消息 ID
    const aiMessageId = await dbService.getNextMessageId();
    const aiSequenceNum = sequenceNum + 1;
    
    // 10. 过滤AI回复中的解析内容（附件、图片、音频解析后的内容），确保不存储到数据库
    let cleanedAnswer = ragResult.answer || '';
    // 移除解析后的文件内容标记
    cleanedAnswer = cleanedAnswer.replace(/\[图片内容[：:][\s\S]*?\]/g, '');
    cleanedAnswer = cleanedAnswer.replace(/\[语音内容[：:][\s\S]*?\]/g, '');
    cleanedAnswer = cleanedAnswer.replace(/\[附件文件内容[：:][\s\S]*?\]/g, '');
    // 移除"总结文件:文件名 内容:"这样的格式
    cleanedAnswer = cleanedAnswer.replace(/总结文件[：:][^\n]*\s*内容[：:][\s\S]*?(?=\n\n|\n[A-Z]|$)/g, '');
    cleanedAnswer = cleanedAnswer.replace(/文件[：:][^\n]*\n内容[：:][\s\S]*?(?=\n\n|\n文件[：:]|$)/g, '');
    // 清理多余的空白行
    cleanedAnswer = cleanedAnswer.replace(/\n\s*\n\s*\n/g, '\n\n');
    cleanedAnswer = cleanedAnswer.trim();
    
    const aiTokenCount = memoryService.estimateTokens(cleanedAnswer);

    // 11. 保存 AI 消息（只保存清理后的内容，不包含解析内容）
    await dbService.createMessage({
      message_id: aiMessageId,
      session_id: actualSessionId,  // 使用实际的会话ID
      role: ragResult.role,
      content: cleanedAnswer, // 只保存清理后的内容，不包含解析内容
      sequence_num: aiSequenceNum,
      token_count: aiTokenCount
    });

    // 12. 使用之前的问题分类结果（已在步骤 5.5 中完成）
    // 注意：RAG 查询时也会进行问题分类，但这里使用用户消息的分类结果
    
    // 13. 保存引用关系（仅在专业问题且有引用时，且没有附件文件）
    // 注意：附件文件现在也走RAG，但附件文件的问题不保存引用关系
    if (isProfessional && !hasAttachments && ragResult.hasRelevantDocs && ragResult.references && ragResult.references.length > 0) {
      // 获取向量检索结果用于保存引用详情
      const documents = await ragService.retrieveDocuments(textForClassification);
      
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
    } else if (isProfessional && !hasAttachments && (!ragResult.hasRelevantDocs || !ragResult.references || ragResult.references.length === 0)) {
      // 零命中问题，仅在专业问题且零命中时保存到 ZeroHitQuestion 表
      // 日常问题不保存到零命中表
      await dbService.saveZeroHitQuestion({
        message_id: actualMessageId,  // 使用实际的消息ID
        session_id: actualSessionId,   // 使用实际的会话ID
        question_text: textForClassification,
        question_hash: questionHash
      });
    }

    // 12. 添加 AI 消息到 Memory（使用清理后的内容）
    memoryService.addMessage(actualSessionId, ragResult.role, cleanedAnswer);

    // 13. 检查是否需要生成摘要
    await memoryService.checkAndSummarize(actualSessionId);

    // 14. 解析存储的content，提取图片、音频和附件信息（用于返回给前端）
    const parsedContent = parseStorageContent(storageContent);
    
    // 处理图片信息：可能是URL对象或data URL字符串（向后兼容）
    let imageInfo = null;
    if (parsedContent.image) {
      if (typeof parsedContent.image === 'string') {
        // 向后兼容：data URL字符串
        const imageMimeType = parsedContent.image.split(';')[0].split(':')[1] || 'image/jpeg';
        imageInfo = {
          name: imageFile?.originalname || 'image',
          type: imageMimeType,
          size: imageFile?.size || 0,
          dataUrl: parsedContent.image
        };
      } else if (typeof parsedContent.image === 'object' && parsedContent.image.url) {
        // 新格式：URL对象
        imageInfo = {
          name: parsedContent.image.originalName || 'image',
          type: parsedContent.image.mimeType || 'image/jpeg',
          size: parsedContent.image.size || 0,
          url: parsedContent.image.url,
          filename: parsedContent.image.filename
        };
      }
    }
    
    // 处理音频信息：可能是URL对象或data URL字符串（向后兼容）
    let audioInfo = null;
    if (parsedContent.audio) {
      if (typeof parsedContent.audio === 'string') {
        // 向后兼容：data URL字符串
        const audioMimeType = parsedContent.audio.split(';')[0].split(':')[1] || 'audio/wav';
        audioInfo = {
          name: audioFile?.originalname || 'audio',
          type: audioMimeType,
          size: audioFile?.size || 0,
          dataUrl: parsedContent.audio
        };
      } else if (typeof parsedContent.audio === 'object') {
        // 新格式：URL对象
        // 如果有url字段，直接使用；否则从filename构建URL
        let audioUrl = parsedContent.audio.url;
        if (!audioUrl && parsedContent.audio.filename) {
          // 从filename构建URL（相对路径）
          audioUrl = `/api/chat-files/${parsedContent.audio.filename}`;
        }
        
        audioInfo = {
          name: parsedContent.audio.originalName || 'audio',
          type: parsedContent.audio.mimeType || 'audio/wav',
          size: parsedContent.audio.size || 0,
          url: audioUrl, // 确保有URL（从url字段或filename构建）
          filename: parsedContent.audio.filename
        };
      }
    }
    
    const attachmentsInfo = parsedContent.attachments || [];
    
    // 15. 返回响应
    if (acceptStream) {
      // 流式响应：发送完成事件
      if (res.writable && !res.destroyed) {
        res.write(`data: ${JSON.stringify({ 
          type: 'done', 
          content: cleanedAnswer, // 使用清理后的内容，不包含解析内容
          references: ragResult.references || [],
          user_message_image: imageInfo, // 包含图片信息
          user_message_audio: audioInfo, // 包含音频信息
          user_message_attachments: attachmentsInfo // 包含附件信息
        })}\n\n`);
        res.end();
      }
    } else {
      // 普通 JSON 响应
      res.json({
        session: {
          session_id: session.session_id,  // 返回实际使用的 session_id
          title: session.title || textForClassification.substring(0, 50),
          created_at: session.created_at
        },
        user_message: {
          message_id: actualMessageId,  // 返回实际使用的 message_id
          created_at: new Date().toISOString(),
          content: parsedContent.text, // 文本内容（只包含用户原始输入，不包含解析内容）
          image: imageInfo, // 包含图片信息
          audio: audioInfo, // 包含音频信息
          attachments: attachmentsInfo // 包含附件信息
        },
        ai_message: {
          message_id: aiMessageId,
          role: ragResult.role,
          content: cleanedAnswer, // 使用清理后的内容，不包含解析内容
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
// 接口5.4: 单独上传和解析文件（图片、音频、附件）
// POST /api/upload-and-parse-file
// 支持：image, audio, attachment
// ============================================
router.post('/upload-and-parse-file', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const fileType = req.body.type; // 'image', 'audio', 'attachment'
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: '没有上传文件'
      });
    }
    
    if (!fileType || !['image', 'audio', 'attachment'].includes(fileType)) {
      return res.status(400).json({
        success: false,
        error: '无效的文件类型，必须是 image、audio 或 attachment'
      });
    }
    
    logger.info('收到文件上传请求', {
      type: fileType,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // 生成临时消息ID用于文件命名
    const tempMessageId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // 修复文件名编码问题
    if (file.originalname) {
      try {
        const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
        if (decoded !== file.originalname) {
          file.originalname = decoded;
        }
      } catch (e) {
        // 解码失败，使用原名称
      }
    }
    
    // 保存文件
    const savedFile = await fileStorageService.saveFile(file, tempMessageId);
    logger.info('文件已保存', {
      filename: savedFile.filename,
      url: savedFile.url
    });
    
    let parsedContent = null;
    let extractedText = null;
    
    // 根据文件类型进行解析
    if (fileType === 'image') {
      // 解析图片
      try {
        logger.info('开始解析图片内容');
        const imageDescription = await multimodalService.understandImage(
          file.buffer,
          '请详细描述这张图片的内容',
          'buffer'
        );
        extractedText = `[图片内容：${imageDescription}]`;
        parsedContent = {
          type: 'image',
          description: imageDescription
        };
        logger.info('图片解析成功', { descriptionLength: imageDescription.length });
      } catch (error) {
        logger.error('图片解析失败', { error: error.message });
        return res.status(500).json({
          success: false,
          error: `图片解析失败: ${error.message}`
        });
      }
    } else if (fileType === 'audio') {
      // 解析音频
      try {
        logger.info('开始解析音频内容');
        const audioFormat = file.originalname.split('.').pop() || 'webm';
        const audioText = await multimodalService.transcribeAudio(file.buffer, audioFormat);
        extractedText = `[语音内容：${audioText}]`;
        parsedContent = {
          type: 'audio',
          transcript: audioText
        };
        logger.info('音频解析成功', { textLength: audioText.length });
      } catch (error) {
        logger.error('音频解析失败', { error: error.message });
        return res.status(500).json({
          success: false,
          error: `音频解析失败: ${error.message}`
        });
      }
    } else if (fileType === 'attachment') {
      // 解析附件文件
      try {
        logger.info('开始解析附件文件内容');
        const content = await fileParserService.parseFile({
          path: savedFile.path,
          filename: savedFile.filename,
          mimeType: savedFile.mimeType,
          originalName: savedFile.originalName
        });
        extractedText = `文件：${savedFile.originalName}\n内容：\n${content}`;
        parsedContent = {
          type: 'attachment',
          content: content
        };
        logger.info('附件文件解析成功', { contentLength: content.length });
      } catch (error) {
        logger.error('附件文件解析失败', { error: error.message });
        return res.status(500).json({
          success: false,
          error: `附件文件解析失败: ${error.message}`
        });
      }
    }
    
    // 返回结果
    res.json({
      success: true,
      file: {
        id: savedFile.filename, // 使用filename作为唯一ID
        url: savedFile.url,
        filename: savedFile.filename,
        originalName: savedFile.originalName,
        mimeType: savedFile.mimeType,
        size: savedFile.size,
        type: fileType
      },
      parsedContent: parsedContent,
      extractedText: extractedText
    });
    
  } catch (error) {
    logger.error('文件上传和解析失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message || '文件上传和解析失败'
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

// ============================================
// 接口10: 获取聊天附件文件
// GET /api/chat-files/:filename
// ============================================
router.get('/chat-files/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // 安全检查：防止路径遍历攻击
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        error: '无效的文件名'
      });
    }
    
    // 检查文件是否存在
    const fileExists = await fileStorageService.fileExists(filename);
    if (!fileExists) {
      return res.status(404).json({
        error: '文件不存在或已过期',
        message: '该文件可能已被清理或不存在'
      });
    }
    
    // 获取文件路径
    const filePath = fileStorageService.getFilePath(filename);
    const fileInfo = await fileStorageService.getFileInfo(filename);
    
    if (!fileInfo || !fileInfo.exists) {
      return res.status(404).json({
        error: '文件不存在或已过期',
        message: '该文件可能已被清理或不存在'
      });
    }
    
    // 设置响应头
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain; charset=utf-8', // 添加UTF-8编码，修复中文乱码
      '.md': 'text/markdown; charset=utf-8', // 添加UTF-8编码
      '.json': 'application/json; charset=utf-8', // 添加UTF-8编码
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      // 音频文件类型
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.webm': 'audio/webm',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', fileInfo.size);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    
    // 发送文件
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    logger.error('获取文件失败', { error: error.message, filename: req.params.filename });
    res.status(500).json({
      error: '获取文件失败',
      message: error.message
    });
  }
});

// ============================================
// 辅助函数：格式化提取的信息（图片/音频）
module.exports = router;

