// Set UTF-8 encoding for Windows console
if (process.platform === 'win32') {
  try {
    if (process.stdout.setDefaultEncoding) {
      process.stdout.setDefaultEncoding('utf8');
    }
    if (process.stderr.setDefaultEncoding) {
      process.stderr.setDefaultEncoding('utf8');
    }
  } catch (e) {
    // Ignore errors
  }
}

const express = require('express');
const cors = require('cors');
const config = require('./config');
const logger = require('../../shared/utils/logger');
const dbService = require('./services/dbService');
const vectorStore = require('./services/vectorStore');
const chatApi = require('./routes/chatApi');

const app = express();

// 中间件
app.use(cors({
  origin: function (origin, callback) {
    // 允许没有 origin 的请求（如移动应用、Postman 等）
    if (!origin) return callback(null, true);
    
    // 检查是否在允许的源列表中
    if (config.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // 开发环境：允许 localhost 的所有端口
      if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        logger.warn('CORS 请求被拒绝', { origin, allowedOrigins: config.allowedOrigins });
        callback(new Error('不允许的 CORS 源'));
      }
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api', chatApi);

// 健康检查
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await dbService.testConnection();
    res.json({
      status: 'ok',
      db_connected: dbConnected,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// 错误处理
app.use((err, req, res, next) => {
  logger.error('服务器错误', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message
  });
});

// 启动服务器
async function startServer() {
  try {
    // 初始化向量存储
    await vectorStore.init();
    logger.info('向量存储初始化成功');

    // 测试数据库连接
    const dbConnected = await dbService.testConnection();
    if (!dbConnected) {
      logger.warn('数据库连接失败，请检查配置');
    }

    const PORT = config.port;
    app.listen(PORT, () => {
      logger.info(`QA Chatbot 后端服务启动成功`, {
        port: PORT,
        env: process.env.NODE_ENV || 'development'
      });
      logger.info(`健康检查: http://localhost:${PORT}/health`);
      logger.info(`API 文档: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    logger.error('服务器启动失败', { error: error.message });
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM 信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('收到 SIGINT 信号，正在关闭服务器...');
  process.exit(0);
});

startServer();

module.exports = app;

