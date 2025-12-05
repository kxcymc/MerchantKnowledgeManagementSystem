const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const config = require('../config');
const logger = require('../utils/logger');
const knowledgeService = require('../services/knowledgeService');
const dbService = require('../services/dbService');
const { ingestFile, ingestRawText, vectorStore } = require('../services/ingestService');
const { publishJob, queueEnabled } = require('../queue/publisher');
const sseService = require('../services/sseService');

const router = express.Router();

// Multer配置（与server.js中的配置保持一致）
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
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
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
    // 使用稳定文件名，确保同名文件覆盖而不是产生多个冗余文件
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { 
    fileSize: config.upload.maxFileSize,
    files: config.upload.maxFiles
  }
});

// POST /api/update - 编辑已有知识（文件或JSON）
// 必传：knowledge_id
// 至少需要提供一个更新字段：新文件名(title)、新文件数据(document 或 content)、新状态(status)、新业务(business)、新场景(scene)
router.post('/update', upload.single('document'), async (req, res) => {
  try {
    const { knowledge_id, title, business, scene, status, content } = req.body;
    const file = req.file;

    const knowledgeId = parseInt(knowledge_id);
    if (isNaN(knowledgeId)) {
      return res.status(400).json({ message: 'knowledge_id 无效' });
    }

    // 至少要有一个更新字段
    if (
      title === undefined &&
      business === undefined &&
      scene === undefined &&
      status === undefined &&
      content === undefined &&
      !file
    ) {
      return res.status(400).json({
        message: '至少需要提供一个更新字段：title、business、scene、status、content 或 document'
      });
    }

    const current = await dbService.getKnowledgeById(knowledgeId);
    if (!current) {
      return res.status(404).json({ message: `knowledge_id ${knowledgeId} 不存在` });
    }

    const updates = {};

    // 通用字段
    if (title !== undefined) {
      updates.title = title;
    }
    if (status !== undefined) {
      updates.status = status;
    }
    if (business !== undefined) {
      updates.business = business;
    }
    if (scene !== undefined) {
      updates.scene = scene;
    }

    // JSON 类型编辑：允许直接修改 content（不通过文件），并同步更新 uploads/json 文件与向量
    if (current.type === 'json') {
      if (file) {
        return res.status(400).json({ message: 'JSON 类型不支持上传文件，请直接编辑内容' });
      }

      // 解析 content（如果有传），否则沿用当前内容
      // 由于使用了 express.json() 中间件，req.body.content 应该已经是对象
      // 但如果前端发送的是字符串（如通过 form-data），仍需要解析
      let newContent = current.content;
      if (content !== undefined) {
        if (typeof content === 'string') {
          try {
            newContent = JSON.parse(content);
          } catch (e) {
            return res.status(400).json({ message: 'content 不是合法的 JSON 字符串' });
          }
        } else {
          // 已经是对象，直接使用
          newContent = content;
        }
        updates.content = newContent;
      }

      // 计算最新的标题/业务/场景/状态
      const nextTitle = updates.title || current.title || '富文本';
      const nextBusiness = updates.business || current.business;
      const nextScene = updates.scene || current.scene;
      const nextStatus = updates.status || current.status;

      try {
        // 1. 删除旧向量
        await vectorStore.removeWhere(
          (record) => record.metadata?.knowledgeId === knowledgeId.toString()
        );

        // 2. 写入新的 JSON 文件（以 knowledgeId + 标题 命名）
        const jsonText =
          newContent !== undefined
            ? JSON.stringify(newContent, null, 2)
            : typeof current.content === 'string'
            ? current.content
            : JSON.stringify(current.content || {}, null, 2);

        const { filePath } = await knowledgeService.saveJsonFile(
          newContent ?? current.content,
          knowledgeId,
          nextTitle
        );

        const newFileUrl = knowledgeService.getFileUrl(filePath); // /uploads/json/xx_title.json
        const storagePath = newFileUrl.replace(/^\//, ''); // uploads/json/xx_title.json

        // 删除旧 JSON 文件（如果路径发生变化）
        if (current.file_url && current.file_url !== newFileUrl) {
          const oldRelative = current.file_url.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
          const oldPath = path.join(config.uploadDir, oldRelative);
          if (oldPath !== filePath) {
            fs.remove(oldPath).catch((err) => {
              logger.warn('更新JSON知识时删除旧JSON文件失败', { oldPath, error: err.message });
            });
          }
        }

        // 3. 重建向量（使用 ingestRawText，带上最新元数据 + storagePath）
        await ingestRawText({
          text: jsonText,
          title: nextTitle,
          tags: [],
          createdBy: 'system',
          customMetadata: {
            knowledgeId: knowledgeId.toString(),
            business: nextBusiness,
            scene: nextScene,
            status: nextStatus,
            isActive: nextStatus === '生效中',
            sourceType: 'json',
            storagePath
          }
        });

        // 4. 更新 MySQL 记录（内容+标题+业务+场景+状态+file_url+file_size）
        await dbService.updateKnowledge(knowledgeId, {
          ...updates,
          title: nextTitle,
          content: newContent,
          business: nextBusiness,
          scene: nextScene,
          status: nextStatus,
          file_url: newFileUrl,
          file_size: Buffer.byteLength(jsonText, 'utf8')
        });
      } catch (error) {
        logger.warn('更新JSON知识时同步文件/向量失败', {
          knowledgeId,
          error: error.message
        });
        return res.status(500).json({ message: error.message });
      }

      return res.json({ message: '更新成功', knowledge_id: knowledgeId });
    }

    // 文件类型（如 PDF）编辑
    // 这里只修改元数据（title/business/scene/status）和物理文件，不改变知识类型
    let finalFileUrl = current.file_url;
    let finalFileSize = current.file_size;

    if (file) {
      // 仅允许单文件
      const originalName = decodeFilename(file.originalname);
      const relativePath = path.basename(file.path);
      finalFileUrl = `/uploads/${relativePath}`;
      finalFileSize = file.size;

      updates.file_url = finalFileUrl;
      updates.file_size = finalFileSize;

      // 删除旧文件（如果存在且不同）
      if (current.file_url) {
        const oldRelative = current.file_url.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
        const oldPath = path.join(config.uploadDir, oldRelative);
        if (oldPath !== file.path) {
          fs.remove(oldPath).catch((err) => {
            logger.warn('删除旧文件失败', { oldPath, error: err.message });
          });
        }
      }

      // 文件更新后需要异步重建向量：投递到队列
      try {
        if (queueEnabled) {
          const job = {
            type: 'knowledge_file',
            payload: {
              knowledgeId,
              filePath: file.path,
              originalName,
              mimeType: file.mimetype,
              business: updates.business || current.business,
              scene: updates.scene || current.scene,
              isUpdate: true
            }
          };

          const ok = await publishJob(job);
          if (!ok) {
            logger.warn('更新文件时投递MQ失败（publish 返回 false，可能未启用队列）', { knowledgeId });
          } else {
            logger.info('更新文件已投递到MQ', { knowledgeId });
          }
        } else {
          logger.warn('队列未启用，更新文件不会重建向量', { knowledgeId });
        }
      } catch (error) {
        logger.error('更新文件时投递MQ异常', { knowledgeId, error: error.message });
      }
    }

    // 元数据（title/business/scene）变更但未上传新文件时，也需要重建向量
    const metadataChangedWithoutFile =
      !file &&
      (title !== undefined || business !== undefined || scene !== undefined || status !== undefined) &&
      current.file_url;

    if (metadataChangedWithoutFile && queueEnabled) {
      try {
        const oldRelative = current.file_url
          .replace(/^\/uploads\//, '')
          .replace(/^uploads\//, '');
        const filePath = path.join(config.uploadDir, oldRelative);
        const originalNameForVector = updates.title || current.title;
        const statusForVector = updates.status || current.status;

        const job = {
          type: 'knowledge_file',
          payload: {
            knowledgeId,
            filePath,
            originalName: originalNameForVector,
            mimeType:
              current.type === 'pdf'
                ? 'application/pdf'
                : current.type === 'docx'
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : 'application/octet-stream',
            business: updates.business || current.business,
            scene: updates.scene || current.scene,
            status: statusForVector,
            isActive: statusForVector === '生效中',
            isUpdate: true
          }
        };

        const ok = await publishJob(job);
        if (!ok) {
          logger.warn('仅元数据更新时投递MQ失败（publish 返回 false，可能未启用队列）', { knowledgeId });
        } else {
          logger.info('仅元数据更新任务已投递到MQ', { knowledgeId });
        }
      } catch (error) {
        logger.error('仅元数据更新时投递MQ异常', { knowledgeId, error: error.message });
      }
    } else if (metadataChangedWithoutFile) {
      logger.warn('元数据更新但队列未启用，向量元数据不会同步更新', { knowledgeId });
    }

    await dbService.updateKnowledge(knowledgeId, updates);

    return res.json({
      message: '更新成功',
      knowledge_id: knowledgeId,
      file_url: finalFileUrl,
      file_size: finalFileSize
    });
  } catch (error) {
    logger.error('更新知识失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
});

// 转义HTML特殊字符
function escapeHtml(str) {
  if (!str) return '文档查看';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// GET /api/mul-query - 多条件查询知识列表
router.get('/mul-query', async (req, res) => {
  try {
    const { title, business, scene, status, start_date, end_date } = req.query;
    
    const results = await dbService.queryKnowledge({
      title,
      business,
      scene,
      status,
      start_date,
      end_date
    });

    // 格式化响应
    const formattedResults = results.map(item => {
      const result = {
        knowledge_id: item.knowledge_id,
        type: item.type,
        file_size: item.file_size,
        file_url: item.file_url || '',
        title: item.title,
        status: item.status,
        business: item.business || '',
        scene: item.scene || ''
      };

      // 如果是JSON类型，返回原始JSON；如果是文件类型，只返回URL
      // 注意：从数据库读取的 content 可能是 JSON 字符串，需要解析
      if (item.type === 'json' && item.content) {
        try {
          result.content = typeof item.content === 'string' 
            ? JSON.parse(item.content) 
            : item.content;
        } catch {
          result.content = item.content;
        }
      }

      return result;
    });

    res.json(formattedResults);
  } catch (error) {
    logger.error('查询知识库失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
});

// GET /api/query - 根据 knowledge_id 查询单条知识
router.get('/query', async (req, res) => {
  try {
    const { knowledge_id } = req.query;

    const id = parseInt(String(knowledge_id), 10);
    if (!knowledge_id || Number.isNaN(id)) {
      return res.status(400).json({ message: 'knowledge_id 无效或未提供' });
    }

    const item = await dbService.getKnowledgeById(id);
    if (!item) {
      return res.status(404).json({ message: `knowledge_id ${id} 不存在` });
    }

    const result = {
      knowledge_id: item.knowledge_id,
      type: item.type,
      file_size: item.file_size,
      file_url: item.file_url || '',
      title: item.title,
      status: item.status,
      business: item.business || '',
      scene: item.scene || ''
    };

    // 注意：从数据库读取的 content 可能是 JSON 字符串，需要解析
    if (item.type === 'json' && item.content) {
      try {
        result.content =
          typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
      } catch {
        result.content = item.content;
      }
    }

    res.json(result);
  } catch (error) {
    logger.error('按 knowledge_id 查询知识失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
});

// POST /api/add - 增加文件（支持文件和JSON）
router.post('/add', upload.single('document'), async (req, res) => {
  try {
    const { business, scene, force_update, knowledge_id, async: useAsync } = req.body;
    const useAsyncMode = useAsync === 'true' || useAsync === true || queueEnabled;

    // 方式1：文件上传
    if (req.file) {
      // 异步模式：使用MQ处理
      if (useAsyncMode && queueEnabled) {
        // 快速操作：只创建MySQL记录（不进行向量化，不删除旧向量数据）
        const result = await knowledgeService.addFileKnowledgeAsync({
          filePath: req.file.path,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          business,
          scene,
          file_url: req.body.file_url || '',
          knowledge_id: knowledge_id ? parseInt(knowledge_id) : undefined
        }, force_update === 'true' || force_update === true);

        // 检查是否是同名文件已存在的情况
        if (result.exists) {
          return res.status(409).json({
            exists: true,
            knowledge_id: result.knowledge_id,
            message: result.message,
            existing: result.existing
          });
        }

        // 快速估算chunk数量（基于文件大小，不读取文件内容）
        let estimatedChunks = null;
        try {
          const stats = await fs.stat(req.file.path);
          // 简单估算：每512字节估算1个chunk（粗略估算，避免读取文件）
          estimatedChunks = Math.max(1, Math.floor(stats.size / 512));
        } catch (error) {
          // 估算失败不影响返回
        }

        // ⚡ 立即返回响应，不等待任何操作
        res.json({
          knowledge_id: result.knowledge_id,
          queued: true,
          status: 'processing',
          message: '文件已加入处理队列',
          estimatedChunks,
          filename: req.file.originalname
        });

        // 异步执行，不阻塞响应
        setImmediate(async () => {
          try {
            await publishJob({
              type: 'knowledge_file',
              payload: {
                knowledgeId: result.knowledge_id,
                filePath: result.filePath || req.file.path, // 使用最终的文件路径（可能是覆盖后的）
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                business,
                scene,
                isUpdate: result.updated || false
              }
            });
            logger.info('文件已加入处理队列', {
              knowledge_id: result.knowledge_id,
              filename: req.file.originalname,
              estimatedChunks
            });
          } catch (error) {
            logger.error('投递任务到队列失败', { 
              knowledge_id: result.knowledge_id,
              error: error.message 
            });
          }
        });

        return; // 已经返回响应，确保函数结束
      }

      // 同步模式：立即处理
      const result = await knowledgeService.addFileKnowledge({
        filePath: req.file.path,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        business,
        scene,
        file_url: req.body.file_url || ''
      }, force_update === 'true' || force_update === true);

      // 检查是否是同名文件已存在的情况
      if (result.exists) {
        // 如果前端明确要求强制更新，则执行更新操作
        if (force_update === 'true' || force_update === true) {
          const updateResult = await knowledgeService.addFileKnowledge({
            filePath: req.file.path,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            business,
            scene,
            file_url: req.body.file_url || '',
            knowledge_id: result.knowledge_id
          }, true); // isUpdate = true
          
          return res.json({ 
            knowledge_id: updateResult.knowledge_id,
            updated: true,
            chunks: updateResult.chunks,
            queued: false
          });
        }
        
        // 否则返回提示信息，让前端决定是否更新
        return res.status(409).json({
          exists: true,
          knowledge_id: result.knowledge_id,
          message: result.message,
          existing: result.existing
        });
      }

      return res.json({ 
        knowledge_id: result.knowledge_id, 
        chunks: result.chunks,
        updated: result.updated || false,
        queued: false
      });
    }

    // 方式2：JSON上传（富文本）
    const { type, file_size, file_url, title, content } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'title 不能为空' });
    }

    if (!content) {
      return res.status(400).json({ message: 'content 不能为空' });
    }

    // 解析JSON内容
    // 由于使用了 express.json() 中间件，req.body.content 应该已经是对象
    // 但如果前端发送的是字符串（如通过 form-data），仍需要解析
    let jsonContent;
    if (typeof content === 'string') {
      try {
        jsonContent = JSON.parse(content);
      } catch {
        return res.status(400).json({ message: 'content 必须是有效的JSON格式' });
      }
    } else {
      // 已经是对象，直接使用
      jsonContent = content;
    }
    
    // 如果指定了knowledge_id和force_update，直接执行更新
    if (force_update === 'true' || force_update === true) {
      if (!knowledge_id) {
        // 如果没有knowledge_id，先查找同名记录
        const existing = await dbService.getKnowledgeByTitle(title);
        if (existing && existing.type === 'json') {
          const updateResult = await knowledgeService.addJsonKnowledge({
            content: jsonContent,
            title,
            business,
            scene
          }, true, existing.knowledge_id); // isUpdate = true
          
          return res.json({ 
            knowledge_id: updateResult.knowledge_id,
            chunks: updateResult.chunks,
            updated: true
          });
        } else {
          return res.status(404).json({ message: '未找到同名记录' });
        }
      } else {
        // 直接使用knowledge_id更新
        const updateResult = await knowledgeService.addJsonKnowledge({
          content: jsonContent,
          title,
          business,
          scene
        }, true, parseInt(knowledge_id)); // isUpdate = true
        
        return res.json({ 
          knowledge_id: updateResult.knowledge_id,
          chunks: updateResult.chunks,
          updated: true
        });
      }
    }
    
    // 正常上传流程，检测同名
    const result = await knowledgeService.addJsonKnowledge({
      content: jsonContent,
      title,
      business,
      scene
    });

    // 检查是否是同名JSON已存在的情况
    if (result.exists) {
      // 返回提示信息，让前端决定是否更新
      return res.status(409).json({
        exists: true,
        knowledge_id: result.knowledge_id,
        message: result.message
      });
    }

    return res.json({ 
      knowledge_id: result.knowledge_id,
      chunks: result.chunks,
      updated: result.updated || false
    });
  } catch (error) {
    logger.error('添加知识失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
});

// POST /api/add/batch - 批量上传（异步模式）
router.post('/add/batch', upload.array('documents', config.upload.maxFiles), async (req, res) => {
  try {
    const { business, scene, async: useAsync } = req.body;
    const files = req.files || [];
    const useAsyncMode = useAsync === 'true' || useAsync === true || queueEnabled;

    if (files.length === 0) {
      return res.status(400).json({ message: '未检测到文件' });
    }

    // 检查文件数量限制
    if (files.length > config.upload.maxFiles) {
      return res.status(400).json({ 
        message: `文件数量超过限制，最多允许上传 ${config.upload.maxFiles} 个文件` 
      });
    }

    // 检查文件大小限制
    const oversizedFiles = files.filter(file => file.size > config.upload.maxFileSize);
    if (oversizedFiles.length > 0) {
      return res.status(400).json({ 
        message: `以下文件超过大小限制（${(config.upload.maxFileSize / 1024 / 1024).toFixed(0)}MB）: ${oversizedFiles.map(f => f.originalname).join(', ')}` 
      });
    }

    const results = [];
    const errors = [];

    // 异步模式：使用MQ处理
    if (useAsyncMode && queueEnabled) {
      // 快速处理：只创建MySQL记录，不进行向量化
      for (const file of files) {
        try {
          const result = await knowledgeService.addFileKnowledgeAsync({
            filePath: file.path,
            originalName: file.originalname,
            mimeType: file.mimetype,
            business,
            scene
          }, false); // 批量上传不自动更新同名文件

          // 检查是否是同名文件已存在的情况
          if (result.exists) {
            errors.push({
              filename: file.originalname,
              error: '文件已存在',
              knowledge_id: result.knowledge_id,
              message: result.message
            });
            continue;
          }

          // 快速估算chunk数量
          let estimatedChunks = null;
          try {
            const stats = await fs.stat(file.path);
            estimatedChunks = Math.max(1, Math.floor(stats.size / 512));
          } catch (error) {
            // 估算失败不影响
          }

          results.push({
            knowledge_id: result.knowledge_id,
            filename: file.originalname,
            file_size: file.size,
            estimatedChunks,
            status: 'processing',
            filePath: result.filePath || file.path // 保存文件路径用于后续队列处理
          });
        } catch (error) {
          logger.error('批量上传单个文件失败', { 
            filename: file.originalname, 
            error: error.message 
          });
          errors.push({
            filename: file.originalname,
            error: error.message
          });
        }
      }

      // ⚡ 立即返回响应
      res.json({
        success: true,
        total: files.length,
        queued: results.length,
        failed: errors.length,
        results: results,
        errors: errors,
        message: `已处理 ${results.length} 个文件，${errors.length} 个失败`
      });

      // 异步执行，批量投递到队列
      if (results.length > 0) {
        setImmediate(async () => {
          try {
            // 批量投递任务到队列
            const jobs = results.map(result => {
              const file = files.find(f => f.originalname === result.filename);
              return {
                type: 'knowledge_file',
                payload: {
                  knowledgeId: result.knowledge_id,
                  filePath: result.filePath || file.path, // 使用最终的文件路径
                  originalName: file.originalname,
                  mimeType: file.mimetype,
                  business,
                  scene,
                  isUpdate: false
                }
              };
            });

            // 逐个投递到队列
            for (const job of jobs) {
              try {
                await publishJob(job);
              } catch (error) {
                logger.error('投递任务到队列失败', { 
                  knowledge_id: job.payload.knowledgeId,
                  error: error.message 
                });
              }
            }

            logger.info('批量文件已加入处理队列', {
              total: results.length,
              filenames: results.map(r => r.filename)
            });
          } catch (error) {
            logger.error('批量投递任务到队列失败', { error: error.message });
          }
        });
      }

      return;
    }

    // 同步模式：立即处理（保留原有逻辑作为备用）
    const knowledgeIds = [];
    for (const file of files) {
      try {
        const knowledge = await knowledgeService.addFileKnowledge({
          filePath: file.path,
          originalName: file.originalname,
          mimeType: file.mimetype,
          business,
          scene
        }, false);

        // 如果是同名文件，跳过
        if (!knowledge.exists) {
          knowledgeIds.push(knowledge.knowledge_id);
        }
      } catch (error) {
        logger.error('批量上传单个文件失败', { 
          filename: file.originalname, 
          error: error.message 
        });
      }
    }

    return res.json({ 
      success: true,
      knowledge_ids: knowledgeIds,
      queued: false
    });
  } catch (error) {
    logger.error('批量上传失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
});

// POST /api/update - 更新知识
router.post('/update', upload.single('document'), async (req, res) => {
  try {
    const { knowledge_id, title, content, business, scene, status } = req.body;

    if (!knowledge_id) {
      return res.status(400).json({ message: 'knowledge_id 不能为空' });
    }

    const existing = await dbService.getKnowledgeById(knowledge_id);
    if (!existing) {
      return res.status(404).json({ message: '知识记录不存在' });
    }

    if (existing.type === 'json') {
      // JSON类型更新
      // 由于使用了 express.json() 中间件，req.body.content 应该已经是对象
      // 但如果前端发送的是字符串（如通过 form-data），仍需要解析
      let jsonContent;
      if (content) {
        if (typeof content === 'string') {
          try {
            jsonContent = JSON.parse(content);
          } catch {
            return res.status(400).json({ message: 'content 必须是有效的JSON格式' });
          }
        } else {
          // 已经是对象，直接使用
          jsonContent = content;
        }
      }

      await knowledgeService.updateJsonKnowledge(knowledge_id, {
        content: jsonContent,
        title,
        business,
        scene,
        status
      });
    } else {
      // 文件类型更新
      const updates = {
        title,
        business,
        scene,
        status
      };

      if (req.file) {
        updates.filePath = req.file.path;
        updates.originalName = req.file.originalname;
        updates.mimeType = req.file.mimetype;
      }

      await knowledgeService.updateFileKnowledge(knowledge_id, updates);
    }

    return res.json({ message: '更新成功', knowledge_id: parseInt(knowledge_id) });
  } catch (error) {
    logger.error('更新知识失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/delete - 删除知识
router.delete('/delete', async (req, res) => {
  try {
    const { knowledge_id } = req.body;

    if (!knowledge_id) {
      return res.status(400).json({ message: 'knowledge_id 不能为空' });
    }

    await knowledgeService.deleteKnowledge(knowledge_id);

    return res.json({ message: '删除成功', knowledge_id: parseInt(knowledge_id) });
  } catch (error) {
    logger.error('删除知识失败', { error: error.message });
    res.status(500).json({ message: error.message });
  }
});

// GET /api/file/:knowledgeId - 通过knowledge_id获取文件（避免URL编码问题）
router.get('/file/:knowledgeId', async (req, res) => {
  try {
    const knowledgeId = parseInt(req.params.knowledgeId);
    if (isNaN(knowledgeId)) {
      return res.status(400).json({ message: '无效的knowledge_id' });
    }

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

    let relativePath = knowledge.file_url.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
    let filePath = path.join(config.uploadDir, relativePath);

    // 检查文件是否存在
    if (!await fs.pathExists(filePath)) {
      // 如果直接路径不存在，尝试在 uploads 目录下查找匹配的文件名
      const filenameFromUrl = path.basename(relativePath);
      const filesInUploadDir = await fs.readdir(config.uploadDir);
      const matchedFile = filesInUploadDir.find(f => {
        // 尝试匹配原始文件名或解码后的文件名
        return f === filenameFromUrl || decodeFilename(f) === filenameFromUrl;
      });
      
      if (matchedFile) {
        filePath = path.join(config.uploadDir, matchedFile);
        logger.info('通过文件名匹配找到文件', { matchedFile, original: relativePath, knowledgeId });
      } else {
        logger.warn('文件不存在', { 
          filePath, 
          file_url: knowledge.file_url,
          relativePath,
          uploadDir: config.uploadDir,
          filesInDir: filesInUploadDir.length,
          knowledgeId 
        });
        return res.status(404).json({ 
          message: `文件不存在: ${knowledge.file_url}`,
          debug: {
            tried: filePath,
            file_url: knowledge.file_url,
            relativePath
          }
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
    
    // 默认返回HTML包装页面（可以设置页面title）
    // 构建完整的文件URL（使用协议和主机，确保在iframe中能正确加载）
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3001';
    const fileUrl = `${protocol}://${host}/api/file/${knowledgeId}?raw=true`;
    const title = escapeHtml(knowledge.title || '文档查看');
    
    // 根据文件类型返回不同的HTML包装
    let html;
    if (ext === '.pdf') {
      html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
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
    object, iframe {
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
    } else if (['.txt', '.md'].includes(ext)) {
      // 对于文本文件，也可以返回HTML包装
      html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
    }
    iframe {
      width: 100%;
      height: calc(100vh - 40px);
      border: 1px solid #ddd;
      background: white;
    }
  </style>
</head>
<body>
  <iframe src="${fileUrl}"></iframe>
</body>
</html>`;
    } else if (['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'].includes(ext)) {
      // Office 文件类型预览
      // 检测是否是 localhost 环境
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0');
      
      if (isLocalhost) {
        // localhost 环境下，Office Online Viewer 无法访问本地文件
        // 直接显示友好的下载提示
        html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
    }
    .container {
      text-align: center;
      background: white;
      padding: 50px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      max-width: 600px;
      margin: 20px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #1f2937;
      margin-bottom: 15px;
      font-size: 1.75rem;
    }
    p {
      margin-bottom: 10px;
      font-size: 1em;
      color: #6b7280;
      line-height: 1.6;
    }
    .file-info {
      background: #f3f4f6;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: left;
    }
    .file-info strong {
      color: #374151;
    }
    .actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 30px;
    }
    a {
      display: inline-block;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s ease;
      font-size: 1em;
    }
    .btn-download {
      background-color: #3b82f6;
      color: white;
    }
    .btn-download:hover {
      background-color: #2563eb;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }
    .btn-open {
      background-color: #10b981;
      color: white;
    }
    .btn-open:hover {
      background-color: #059669;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    }
    .note {
      margin-top: 20px;
      padding: 15px;
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      border-radius: 4px;
      text-align: left;
      font-size: 0.9em;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📄</div>
    <h1>Office 文件预览</h1>
    <p>此文件类型需要在本地环境中下载后使用 Office 软件打开。</p>
    <div class="file-info">
      <p><strong>文件名：</strong>${title}${ext}</p>
      <p><strong>文件类型：</strong>${ext.toUpperCase().replace('.', '')} 文档</p>
    </div>
    <div class="actions">
      <a href="${fileUrl}" download="${title}${ext}" class="btn-download">⬇️ 下载文件</a>
      <a href="${fileUrl}" target="_blank" class="btn-open">🔗 在新窗口打开</a>
    </div>
    <div class="note">
      <strong>提示：</strong>在本地开发环境中，Office 文件无法直接在浏览器中预览。请下载文件后使用 Microsoft Office、WPS Office 或其他兼容软件打开。
    </div>
  </div>
</body>
</html>`;
      } else {
        // 公网环境下，尝试使用 Office Online Viewer
        const encodedFileUrl = encodeURIComponent(fileUrl);
        const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedFileUrl}`;
        
        html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
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
      display: flex;
      flex-direction: column;
    }
    .viewer-container {
      flex: 1;
      position: relative;
      width: 100%;
      height: 100%;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
    .fallback {
      display: none;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: white;
      text-align: center;
      padding: 40px;
      box-sizing: border-box;
      overflow-y: auto;
    }
    .fallback h1 {
      color: #0056b3;
      margin-bottom: 20px;
      font-size: 1.5rem;
    }
    .fallback p {
      margin-bottom: 30px;
      font-size: 1.1em;
      color: #666;
    }
    .fallback a {
      display: inline-block;
      background-color: #007bff;
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      text-decoration: none;
      font-weight: bold;
      transition: background-color 0.3s ease;
      margin: 5px;
    }
    .fallback a:hover {
      background-color: #0056b3;
    }
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 1.2em;
    }
  </style>
</head>
<body>
  <div class="viewer-container">
    <div class="loading" id="loading">正在加载预览...</div>
    <iframe 
      src="${viewerUrl}" 
      id="office-viewer"
      title="${title}"
      style="display: none;"
    ></iframe>
    <div class="fallback" id="fallback">
      <h1>预览加载失败</h1>
      <p>Office Online Viewer 无法加载此文件。可能的原因：</p>
      <ul style="text-align: left; margin: 20px 0; color: #666; max-width: 500px; margin-left: auto; margin-right: auto;">
        <li>文件 URL 不是公开可访问的</li>
        <li>网络连接问题</li>
        <li>文件格式不支持</li>
      </ul>
      <a href="${fileUrl}" download="${title}${ext}">下载文件</a>
      <a href="${fileUrl}" target="_blank">在新窗口打开</a>
    </div>
  </div>
  <script>
    const iframe = document.getElementById('office-viewer');
    const loading = document.getElementById('loading');
    const fallback = document.getElementById('fallback');
    
    // 监听 iframe 加载完成
    iframe.onload = function() {
      loading.style.display = 'none';
      iframe.style.display = 'block';
      // 检查是否加载成功（5秒后检查）
      setTimeout(function() {
        try {
          // 尝试访问 iframe 内容
          if (iframe.contentWindow && iframe.contentWindow.document) {
            const iframeDoc = iframe.contentWindow.document;
            // 如果 iframe 内容为空或包含错误信息，显示备用选项
            if (!iframeDoc.body || iframeDoc.body.innerHTML.trim() === '' || 
                iframeDoc.body.innerHTML.includes('error') || 
                iframeDoc.body.innerHTML.includes('无法')) {
              showFallback();
            }
          }
        } catch (e) {
          // 跨域限制，无法检查内容，假设加载成功
        }
      }, 5000);
    };
    
    // 监听 iframe 加载错误
    iframe.onerror = function() {
      showFallback();
    };
    
    // 如果 15 秒后仍然在加载，显示备用选项
    setTimeout(function() {
      if (loading.style.display !== 'none') {
        showFallback();
      }
    }, 15000);
    
    function showFallback() {
      loading.style.display = 'none';
      iframe.style.display = 'none';
      fallback.style.display = 'block';
    }
  </script>
</body>
</html>`;
      }
    } else {
      // 其他文件类型，返回下载提示页面
      html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background-color: #f0f2f5;
      color: #333;
    }
    .container {
      text-align: center;
      background: #fff;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    }
    h1 {
      color: #0056b3;
      margin-bottom: 20px;
    }
    p {
      margin-bottom: 30px;
      font-size: 1.1em;
    }
    a {
      display: inline-block;
      background-color: #007bff;
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      text-decoration: none;
      font-weight: bold;
      transition: background-color 0.3s ease;
    }
    a:hover {
      background-color: #0056b3;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>文件类型不支持直接预览</h1>
    <p>您正在尝试访问的文件类型 (${ext}) 无法在浏览器中直接预览。</p>
    <a href="${fileUrl}" download="${title}${ext}">点击此处下载文件</a>
  </div>
</body>
</html>`;
    }
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);

  } catch (error) {
    logger.error('文件访问失败', { error: error.message, knowledgeId: req.params.knowledgeId });
    res.status(500).json({ message: error.message });
  }
});

// GET /api/events - SSE 事件流（用于实时通知）
router.get('/events', (req, res) => {
  const clientId = sseService.addClient(res);
  
  // 发送初始连接成功消息
  res.write(`data: ${JSON.stringify({ 
    type: 'connected', 
    clientId,
    message: '已连接到事件流'
  })}\n\n`);
  
  // 保持连接
  req.on('close', () => {
    sseService.removeClient(clientId);
  });
});

// ============== RAG Chat API ==============
const chatService = require('../services/chatService');

/**
 * POST /api/chat - RAG 对话接口（SSE 流式响应）
 * 
 * 请求体：
 * {
 *   "message": "用户问题",
 *   "session_id": "会话ID（可选）",
 *   "history": [
 *     { "role": "user", "content": "之前的问题" },
 *     { "role": "assistant", "content": "之前的回答" }
 *   ]
 * }
 * 
 * SSE 响应格式：
 * data: {"type": "token", "content": "部分回答"}
 * data: {"type": "done", "content": "完整回答", "references": [...]}
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, session_id, history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ message: '消息内容不能为空' });
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 发送开始事件
    res.write(`data: ${JSON.stringify({ type: 'start', session_id })}\n\n`);

    // 调用 RAG Chat 服务
    chatService.streamChat({
      message: message.trim(),
      history,
      sessionId: session_id,
      onToken: (token) => {
        res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
      },
      onDone: (result) => {
        res.write(`data: ${JSON.stringify({ 
          type: 'done', 
          content: result.content,
          references: result.references,
          session_id: result.sessionId
        })}\n\n`);
        res.end();
      },
      onError: (error) => {
        logger.error('Chat 接口错误', { error: error.message, session_id });
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          message: error.message || '服务暂时不可用，请稍后重试'
        })}\n\n`);
        res.end();
      }
    });

    // 客户端断开连接时清理
    req.on('close', () => {
      logger.info('Chat 客户端断开连接', { session_id });
    });

  } catch (error) {
    logger.error('Chat 接口异常', { error: error.message });
    
    // 如果还没发送 SSE 头，返回 JSON 错误
    if (!res.headersSent) {
      return res.status(500).json({ message: error.message });
    }
    
    // 已经是 SSE 模式，发送错误事件
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

module.exports = router;

