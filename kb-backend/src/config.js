const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const rootDir = process.cwd();

const valueOrDefault = (envValue, fallback) => {
  if (!envValue) return fallback;
  return envValue;
};

const parseOrigins = (value) =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

// 存储模式：'json' | 'persistent' | 'server'
const vectorStoreMode = process.env.VECTOR_STORE_MODE || 'server';

module.exports = {
  port: Number(process.env.PORT || 3001),
  allowedOrigins: process.env.ALLOW_ORIGINS ? parseOrigins(process.env.ALLOW_ORIGINS) : ['http://localhost:5173'],
  dashScopeKey: process.env.DASHSCOPE_API_KEY || '',
  // 阿里云 OCR API Key（使用 DashScope API，与 DASHSCOPE_API_KEY 相同）
  aliyunOcrApiKey: process.env.ALIYUN_OCR_API_KEY || process.env.DASHSCOPE_API_KEY || '',
  uploadDir: path.resolve(valueOrDefault(process.env.UPLOAD_DIR, path.join(rootDir, 'uploads'))),
  vectorStorePath: path.resolve(valueOrDefault(process.env.VECTOR_STORE_PATH, path.join(rootDir, 'data', 'vector-store.json'))),
  vectorStore: {
    mode: vectorStoreMode, // 'json' | 'persistent' | 'server'
  },
  chroma: {
    mode: process.env.CHROMA_MODE || 'server', // 'persistent' | 'server'
    host: process.env.CHROMA_HOST || 'localhost',
    port: Number(process.env.CHROMA_PORT || 8000),
    path: path.resolve(valueOrDefault(process.env.CHROMA_DB_PATH, path.join(rootDir, 'data', 'chroma_db'))),
    collectionName: process.env.CHROMA_COLLECTION_NAME || 'kb_documents'
  },
  queue: {
    url: process.env.RABBIT_URL || '',
    name: process.env.QUEUE_NAME || 'kb_ingest'
  },
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'KBase',
    password: process.env.MYSQL_PASSWORD || '123456',
    database: process.env.MYSQL_DATABASE || 'kb_database'
  },
  upload: {
    maxFiles: Number(process.env.MAX_UPLOAD_FILES || 20), // 批量上传最大文件数
    maxFileSize: Number(process.env.MAX_FILE_SIZE || 25 * 1024 * 1024) // 单个文件最大大小（25MB）
  }
};

