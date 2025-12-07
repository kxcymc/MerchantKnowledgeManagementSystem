const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

const valueOrDefault = (envValue, fallback) => {
  if (!envValue) return fallback;
  return envValue;
};

const parseOrigins = (value) =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

module.exports = {
  port: Number(process.env.PORT || 3002),
  allowedOrigins: process.env.ALLOW_ORIGINS ? parseOrigins(process.env.ALLOW_ORIGINS) : ['http://localhost:5173', 'http://localhost:5555'],
  
  // DashScope API (千问)
  dashScopeKey: process.env.DASHSCOPE_API_KEY || '',
  dashScopeBaseURL: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  
  // 火山方舟引擎 API
  volcanoArkKey: process.env.VOLCANO_ARK_API_KEY || '',
  volcanoArkBaseURL: process.env.VOLCANO_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
  
  // DeepSeek API
  deepSeekKey: process.env.DEEPSEEK_API_KEY || '',
  deepSeekBaseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
  
  // LLM 配置
  llm: {
    // 默认模型：火山方舟引擎
    provider: process.env.LLM_PROVIDER || 'volcano_ark', // 'volcano_ark' | 'deepseek' | 'qwen'
    model: process.env.LLM_MODEL || 'doubao-seed-1-6-flash-250828', // 火山方舟模型名称（doubao-seed系列），或 deepseek-chat，或 qwen-turbo
    baseURL: process.env.LLM_BASE_URL || '', // 如果为空，会根据 provider 自动选择
    temperature: Number(process.env.LLM_TEMPERATURE || 0.7)
  },
  
  // Chroma 向量数据库配置
  chroma: {
    host: process.env.CHROMA_HOST || 'localhost',
    port: Number(process.env.CHROMA_PORT || 8000),
    collectionName: process.env.CHROMA_COLLECTION_NAME || 'kb_documents'
  },
  
  // MySQL 数据库配置（QA Chatbot 业务数据库）
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || '',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'kb_database'
  },
  
  // 知识库数据库配置（用于检索 Knowledge 表）
  kbaseDb: {
    host: process.env.KBASE_DATABASE_HOST || process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.KBASE_DATABASE_PORT || process.env.MYSQL_PORT || 3306),
    user: process.env.KBASE_DATABASE_USER || 'KBase',
    password: process.env.KBASE_DATABASE_PASSWORD || '',
    database: process.env.KBASE_DATABASE_NAME || 'kb_database'
  },
  
  // RAG 配置
  rag: {
    topK: Number(process.env.RAG_TOP_K || 5),
    minScore: Number(process.env.RAG_MIN_SCORE || 0.3),
    maxContextTokens: Number(process.env.MAX_CONTEXT_TOKENS || 4000)
  },
  
  // Memory 配置
  memory: {
    windowSize: Number(process.env.MEMORY_WINDOW_SIZE || 6), // 最近层保留的轮数
    summaryThreshold: Number(process.env.MEMORY_SUMMARY_THRESHOLD || 10), // 触发摘要的消息数量阈值
    middleLayerSize: Number(process.env.MEMORY_MIDDLE_LAYER_SIZE || 4), // 中间层保留的轮数
    summaryTokenRatio: Number(process.env.MEMORY_SUMMARY_TOKEN_RATIO || 0.15), // 摘要占用的token比例（15%）
    middleTokenRatio: Number(process.env.MEMORY_MIDDLE_TOKEN_RATIO || 0.25), // 中间层占用的token比例（25%）
    recentTokenRatio: Number(process.env.MEMORY_RECENT_TOKEN_RATIO || 0.6) // 最近层占用的token比例（60%）
  },
  
  // 问题聚类配置
  clustering: {
    similarityThreshold: Number(process.env.CLUSTERING_SIMILARITY_THRESHOLD || 0.75),
    maxSimilarClusters: Number(process.env.CLUSTERING_MAX_SIMILAR_CLUSTERS || 10),
    enabled: process.env.CLUSTERING_ENABLED !== 'false' // 默认启用
  },
  
  // 文件上传目录配置（用于文件预览）
  uploadDir: process.env.UPLOAD_DIR || (() => {
    // 尝试多个可能的路径
    const possiblePaths = [
      path.join(__dirname, '../../kb-backend/uploads'),
      path.join(process.cwd(), 'kb-backend/uploads'),
      path.join(process.cwd(), '../kb-backend/uploads'),
      path.join(process.cwd(), 'uploads')
    ];
    
    // 返回第一个存在的路径，或默认路径
    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          return p;
        }
      } catch (e) {
        // 忽略错误
      }
    }
    
    // 如果都不存在，返回默认路径
    return possiblePaths[0];
  })()
};

