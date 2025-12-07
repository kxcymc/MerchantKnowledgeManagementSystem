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

const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs-extra');
const config = require('./config');
const logger = require('../../shared/utils/logger');
const { ingestFile, ingestRawText, estimateChunkCount, vectorStore } = require('./services/ingestService');
const uploadService = require('./services/uploadService');
const { publishJob, queueEnabled } = require('./queue/publisher');
const { startConsumer } = require('./queue/consumer');
const dbService = require('./services/dbService');
const apiRoutes = require('./routes/api');

const app = express();

fs.ensureDirSync(config.uploadDir);
fs.ensureDirSync(path.dirname(config.vectorStorePath));
// Ensure Chroma DB directory exists
fs.ensureDirSync(config.chroma.path);

const allowedMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/plain',
  'text/markdown'
];

const decodeFilename = (name = '') => {
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
      // 检查解码后的字符串是否包含明显的乱码字符
      if (!/[\uFFFD]/.test(latin1Decoded) && latin1Decoded !== name) {
        // 验证是否包含中文字符（如果原始名称应该包含中文）
        if (/[\u4e00-\u9fa5]/.test(latin1Decoded)) {
          return latin1Decoded;
        }
      }
    } catch (e) {
      // 忽略 latin1 解码错误
    }
    
    // 方法3: 如果已经是有效的 UTF-8，直接返回
    try {
      // 检查是否是有效的 UTF-8
      Buffer.from(name, 'utf8');
      return name;
    } catch (e) {
      // 不是有效的 UTF-8，继续
    }
    
    // 方法4: 如果都失败，返回原始名称
    return name;
  } catch {
    return name;
  }
};

const sanitizeFilename = (name = '') => {
  const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned || 'upload';
};

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.ensureDir(config.uploadDir);
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const decodedName = decodeFilename(file.originalname);
    file.originalname = decodedName;
    const safeName = sanitizeFilename(decodedName);
    const uniqueName = `${Date.now()}-${safeName}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { 
    fileSize: config.upload.maxFileSize,
    files: config.upload.maxFiles
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      !allowedMimeTypes.includes(file.mimetype) &&
      !['.pdf', '.docx', '.txt', '.md', '.markdown', '.xlsx', '.xls'].includes(ext)
    ) {
      return cb(new Error('暂不支持该文件类型'));
    }
    cb(null, true);
  }
});

app.use(cors({ origin: config.allowedOrigins, credentials: true }));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));
// 添加 uploads 目录作为静态文件服务，支持中文文件名
app.use('/uploads', express.static(config.uploadDir, {
  index: false,
  dotfiles: 'ignore',
  setHeaders: (res, filePath) => {
    // 设置正确的Content-Type
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (filePath.endsWith('.docx')) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    } else if (filePath.endsWith('.txt')) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    } else if (filePath.endsWith('.md') || filePath.endsWith('.markdown')) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    } else if (filePath.endsWith('.xlsx')) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else if (filePath.endsWith('.xls')) {
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
    }
  }
}));

// 统一API路由
app.use('/api', apiRoutes);

app.get('/health', async (req, res) => {
  const count = await vectorStore.count();
  res.json({
    status: 'ok',
    records: count,
    queueEnabled
  });
});

app.get('/api/vectors', async (req, res) => {
  const limit = Number(req.query.limit) || 25;
  const items = await vectorStore.list(limit);
  res.json(items);
});

const normalizePathsInput = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean);
  return [input].filter(Boolean);
};

app.post('/api/text', async (req, res) => {
  try {
    const { text, title, tags, createdBy } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'text 不能为空' });
    }
    const payload = {
      text,
      title: title || '自定义文本',
      tags: tags || [],
      createdBy: createdBy || 'anonymous'
    };
    if (queueEnabled) {
      await publishJob({ type: 'text', payload });
      return res.json({ message: '文本已加入队列', queued: true });
    }
    const chunkCount = await ingestRawText(payload);
    res.json({ message: '文本已入库', chunks: chunkCount });
  } catch (error) {
    logger.error('文本入库失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/uploads', async (req, res) => {
  try {
    const uploads = await uploadService.listUploads();
    res.json(uploads);
  } catch (error) {
    logger.error('查询上传列表失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/uploads', async (req, res) => {
  try {
    const { storagePath, storagePaths } = req.body || {};
    const paths = normalizePathsInput(storagePaths || storagePath);
    if (paths.length === 0) {
      return res.status(400).json({ message: 'storagePath 不能为空' });
    }
    if (queueEnabled) {
      await publishJob({ type: 'delete_files', payload: { storagePaths: paths } });
      return res.json({ message: '删除任务已加入队列', total: paths.length, queued: true });
    }
    let removedTotal = 0;
    for (const target of paths) {
      const result = await uploadService.deleteUpload(target);
      removedTotal += result.removedChunks ?? 0;
    }
    res.json({ message: '文件已删除', files: paths.length, removedChunks: removedTotal, queued: false });
  } catch (error) {
    logger.error('删除上传文件失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/uploads/expire', async (req, res) => {
  try {
    const { storagePath, storagePaths, expired } = req.body || {};
    const paths = normalizePathsInput(storagePaths || storagePath);
    if (paths.length === 0) {
      return res.status(400).json({ message: 'storagePath 不能为空' });
    }
    const targetState = Boolean(expired);
    if (queueEnabled) {
      await publishJob({ type: 'expire_files', payload: { storagePaths: paths, expired: targetState } });
      return res.json({ message: targetState ? '过期任务已加入队列' : '取消过期任务已加入队列', total: paths.length, queued: true });
    }
    let updatedTotal = 0;
    for (const target of paths) {
      const result = await uploadService.setUploadExpired(target, targetState);
      updatedTotal += result.updatedChunks ?? 0;
    }
    res.json({
      message: targetState ? '已标记过期' : '已取消过期',
      files: paths.length,
      updatedChunks: updatedTotal,
      queued: false
    });
  } catch (error) {
    logger.error('更新过期状态失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '未检测到文件' });
    }
    const payload = {
      filePath: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      uploadedBy: req.body?.uploadedBy || 'anonymous'
    };
    if (queueEnabled) {
      // 队列模式：先预估 chunk 数量，然后加入队列
      let estimatedChunks = null;
      try {
        estimatedChunks = await estimateChunkCount(payload);
        if (estimatedChunks === 0) estimatedChunks = null; // 0 表示预估失败
      } catch (error) {
        logger.warn('预估 chunk 数量失败，将继续加入队列', { error: error.message, filename: payload.originalName });
      }
      await publishJob({ type: 'file', payload });
      return res.json({ 
        message: '已加入处理队列', 
        queued: true, 
        estimatedChunks: estimatedChunks,
        filename: payload.originalName
      });
    }
    const chunkCount = await ingestFile(payload);
    res.json({ message: '文件已入库', chunks: chunkCount, queued: false });
  } catch (error) {
    logger.error('文件入库失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/upload/batch', upload.array('documents', 20), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ message: '未检测到文件' });
    }
    const uploadedBy = req.body?.uploadedBy || 'anonymous';
    const payloads = files.map((file) => ({
      filePath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      uploadedBy
    }));
    if (queueEnabled) {
      // 批量上传：预估总 chunk 数量
      let totalEstimatedChunks = 0;
      const estimatedChunksPerFile = [];
      for (const payload of payloads) {
        try {
          const estimated = await estimateChunkCount(payload);
          estimatedChunksPerFile.push(estimated);
          totalEstimatedChunks += estimated;
        } catch (error) {
          logger.warn('预估文件 chunk 数量失败', { filename: payload.originalName, error: error.message });
          estimatedChunksPerFile.push(0);
        }
      }
      await publishJob({ type: 'file_batch', payload: payloads });
      return res.json({ 
        message: '批量上传任务已加入队列', 
        total: payloads.length, 
        queued: true,
        estimatedChunks: totalEstimatedChunks || null,
        estimatedChunksPerFile: estimatedChunksPerFile.length > 0 ? estimatedChunksPerFile : null
      });
    }
    let totalChunks = 0;
    for (const payload of payloads) {
      totalChunks += await ingestFile(payload);
    }
    res.json({ message: '批量文件已入库', files: payloads.length, chunks: totalChunks, queued: false });
  } catch (error) {
    logger.error('批量文件入库失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ message: err.message });
});

app.listen(config.port, async () => {
  logger.info(`Knowledge base builder listening on ${config.port}`);
  
  // 测试MySQL连接
  try {
    const connected = await dbService.testConnection();
    if (!connected) {
      logger.warn('MySQL 数据库连接失败，部分功能可能无法使用');
    }
  } catch (error) {
    logger.warn('MySQL 数据库连接测试失败', { error: error.message });
  }
  
  // 如果启用了队列，在服务器启动时同时启动队列消费者
  if (queueEnabled) {
    logger.info('队列已启用，正在启动队列消费者...');
    // 延迟一点启动消费者，确保服务器完全启动
    setTimeout(() => {
      startConsumer().catch(err => {
        logger.error('队列消费者启动失败', { error: err.message });
      });
    }, 1000);
  } else {
    logger.info('队列未启用，使用同步处理模式');
  }
});

// 优雅关闭处理
const gracefulShutdown = async () => {
  logger.info('收到停止信号，正在关闭服务器...');
  
  // 停止队列消费者
  if (queueEnabled) {
    const { stopConsumer } = require('./queue/consumer');
    await stopConsumer();
  }
  
  process.exit(0);
};

// 全局错误处理，防止未捕获的异常导致进程崩溃
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常', { 
    error: error.message, 
    stack: error.stack,
    name: error.name
  });
  
  // 如果是 OCR 相关的错误，记录但不崩溃
  if (error.message && error.message.includes('OCR')) {
    logger.error('OCR 相关错误已捕获，不会导致进程崩溃', {
      error: error.message,
      hint: '请检查 OCR API Key 是否正确配置'
    });
    return; // 不退出进程
  }
  
  // 其他未捕获的异常，记录后退出
  logger.error('致命错误，进程将退出');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝', { 
    reason: reason?.message || reason,
    stack: reason?.stack
  });
  
  // 如果是 OCR 相关的错误，记录但不崩溃
  if (reason && typeof reason === 'object' && reason.message && reason.message.includes('OCR')) {
    logger.error('OCR 相关的 Promise 拒绝已捕获，不会导致进程崩溃', {
      error: reason.message,
      hint: '请检查 OCR API Key 是否正确配置'
    });
    return; // 不退出进程
  }
});

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

