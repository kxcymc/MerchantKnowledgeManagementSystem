const axios = require('axios');
const logger = require('../../../shared/utils/logger');
const config = require('../config');
const { vectorStore } = require('./ingestService');
const DashScopeEmbeddings = require('../../../shared/utils/dashscopeEmbeddings');

// DashScope LLM 配置（使用 OpenAI 兼容模式，与 ai-sdk-rag-starter 保持一致）
// 参考: ai-sdk-rag-starter/app/api/chat/route.ts
const getDashScopeChatUrl = () => {
  const baseUrl = config.dashScopeBaseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  return `${baseUrl}/chat/completions`;
};
const DEFAULT_MODEL = 'qwen-plus';

// Embedding 实例（复用）
let embeddingsInstance = null;

const getEmbeddings = () => {
  if (embeddingsInstance) return embeddingsInstance;
  if (!config.dashScopeKey) {
    throw new Error('DASHSCOPE_API_KEY 未配置');
  }
  embeddingsInstance = new DashScopeEmbeddings({
    dashScopeApiKey: config.dashScopeKey,
    model: 'text-embedding-v3'
  });
  return embeddingsInstance;
};

/**
 * 检索相关知识库内容
 * @param {string} query - 用户问题
 * @param {number} topK - 返回数量
 * @returns {Promise<Array>} 相关文档列表
 */
async function retrieveRelevantDocs(query, topK = 5) {
  try {
    // 生成查询向量
    const embeddings = getEmbeddings();
    const queryEmbedding = await embeddings.embedQuery(query);
    
    // 确保 vectorStore 已初始化
    if (!vectorStore.initialized) {
      await vectorStore.init();
    }
    
    // 相似度搜索
    const results = await vectorStore.similaritySearch(queryEmbedding, topK);
    
    logger.info('知识库检索完成', { 
      query: query.substring(0, 50), 
      resultsCount: results.length 
    });
    
    return results;
  } catch (error) {
    logger.error('知识库检索失败', { error: error.message });
    return [];
  }
}

/**
 * 构建 RAG Prompt
 * @param {string} userMessage - 用户问题
 * @param {Array} relevantDocs - 相关文档
 * @param {Array} history - 对话历史
 * @returns {Array} messages 数组
 */
function buildRAGPrompt(userMessage, relevantDocs, history = []) {
  // 系统提示词
  const systemPrompt = `你是一个专业的知识库助手，负责回答用户关于抖音电商相关的问题。

## 回答规则：
1. 仅根据提供的【参考资料】回答问题，不要编造信息
2. 如果参考资料中没有相关信息，请明确告知用户"根据现有知识库，暂未找到相关信息"
3. 回答时请保持专业、准确、简洁
4. 如果引用了具体文档内容，请在回答末尾标注来源
5. 使用中文回答`;

  // 构建参考资料
  let contextText = '';
  if (relevantDocs && relevantDocs.length > 0) {
    contextText = '\n\n【参考资料】\n';
    relevantDocs.forEach((doc, index) => {
      const filename = doc.metadata?.filename || doc.metadata?.title || '未知来源';
      const page = doc.metadata?.page ? `(第${doc.metadata.page}页)` : '';
      contextText += `\n[${index + 1}] ${filename}${page}:\n${doc.text}\n`;
    });
  }

  // 构建 messages 数组
  const messages = [
    { role: 'system', content: systemPrompt + contextText }
  ];

  // 添加历史对话（最近 10 轮）
  const recentHistory = history.slice(-20); // 最多 10 轮（20 条消息）
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content
    });
  }

  // 添加当前用户问题
  messages.push({ role: 'user', content: userMessage });

  return messages;
}

/**
 * 提取引用来源
 * @param {Array} relevantDocs - 相关文档
 * @returns {Array} 引用来源列表
 */
function extractReferences(relevantDocs) {
  if (!relevantDocs || relevantDocs.length === 0) return [];
  
  const references = [];
  const seen = new Set();
  
  for (const doc of relevantDocs) {
    const filename = doc.metadata?.filename || doc.metadata?.title;
    if (!filename || seen.has(filename)) continue;
    
    seen.add(filename);
    references.push({
      filename,
      knowledge_id: doc.metadata?.knowledgeId,
      page: doc.metadata?.page,
      score: doc.score
    });
  }
  
  return references;
}

/**
 * 流式调用 DashScope LLM
 * @param {Object} options - 选项
 * @param {string} options.message - 用户消息
 * @param {Array} options.history - 对话历史
 * @param {string} options.sessionId - 会话 ID
 * @param {Function} options.onToken - 收到 token 时的回调
 * @param {Function} options.onDone - 完成时的回调
 * @param {Function} options.onError - 错误时的回调
 */
async function streamChat({ message, history = [], sessionId, onToken, onDone, onError }) {
  try {
    // 检查 API Key 配置
    if (!config.dashScopeKey || config.dashScopeKey.trim() === '') {
      throw new Error('DASHSCOPE_API_KEY 未配置，请在 .env 文件中设置');
    }
    
    // 清理 API Key（去除可能的换行符和空格）
    const apiKey = config.dashScopeKey.trim().replace(/[\r\n]/g, '');
    
    // 1. 检索相关文档
    const relevantDocs = await retrieveRelevantDocs(message);
    
    // 2. 构建 RAG Prompt
    const messages = buildRAGPrompt(message, relevantDocs, history);
    
    // 3. 提取引用来源
    const references = extractReferences(relevantDocs);
    
    // 4. 调用 DashScope LLM（流式，使用 OpenAI 兼容模式）
    // 参考: ai-sdk-rag-starter 使用 @ai-sdk/openai 的 createOpenAI
    const response = await axios.post(
      getDashScopeChatUrl(),
      {
        model: DEFAULT_MODEL,
        messages,
        stream: true // OpenAI 兼容模式的流式参数
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream',
        timeout: 60000
      }
    );

    let fullContent = '';
    let buffer = '';

    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      
      // 处理 SSE 格式数据（OpenAI 兼容格式）
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留不完整的行
      
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const jsonStr = line.slice(5).trim();
          if (jsonStr === '[DONE]') {
            continue;
          }
          
          try {
            const data = JSON.parse(jsonStr);
            // OpenAI 兼容格式: choices[0].delta.content
            const content = data.choices?.[0]?.delta?.content;
            
            if (content) {
              fullContent += content;
              onToken && onToken(content);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    });

    response.data.on('end', () => {
      onDone && onDone({
        content: fullContent,
        references,
        sessionId
      });
    });

    response.data.on('error', (error) => {
      logger.error('LLM 流式响应错误', { error: error.message });
      onError && onError(error);
    });

  } catch (error) {
    logger.error('Chat 服务错误', { error: error.message });
    onError && onError(error);
  }
}

/**
 * 非流式调用（用于测试）
 */
async function chat({ message, history = [], sessionId }) {
  return new Promise((resolve, reject) => {
    let content = '';
    let result = null;
    
    streamChat({
      message,
      history,
      sessionId,
      onToken: (token) => { content += token; },
      onDone: (data) => { 
        result = data;
        resolve(result); 
      },
      onError: (error) => { reject(error); }
    });
  });
}

module.exports = {
  streamChat,
  chat,
  retrieveRelevantDocs,
  buildRAGPrompt,
  extractReferences
};
