const path = require('path');
const fs = require('fs-extra');
const config = require('../config');
const logger = require('../../../shared/utils/logger');
const dbService = require('./dbService');
const { ingestFile, ingestRawText, vectorStore } = require('./ingestService');
const { extractTextFromFile } = require('./textExtractor');
const TextCleaner = require('./textCleaner');
const sseService = require('./sseService');

// 保存JSON文件到本地（以标题命名，附带knowledgeId防止完全重名冲突）
async function saveJsonFile(jsonContent, knowledgeId, title) {
  const jsonDir = path.join(config.uploadDir, 'json');
  await fs.ensureDir(jsonDir);

  // 安全化标题，去掉不合法文件名字符
  const safeTitle =
    (title || `knowledge_${knowledgeId}`)
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .trim() || `knowledge_${knowledgeId}`;

  // 文件名格式：<knowledgeId>_<安全标题>.json，方便人工查看和排查
  const filename = `${knowledgeId}_${safeTitle}.json`;
  const filePath = path.join(jsonDir, filename);
  
  const jsonString = typeof jsonContent === 'string' 
    ? jsonContent 
    : JSON.stringify(jsonContent, null, 2);
  
  await fs.writeFile(filePath, jsonString, 'utf8');
  
  return {
    filePath,
    filename,
    relativePath: path.relative(config.uploadDir, filePath).replace(/\\/g, '/')
  };
}

// 生成文件URL（存储绝对路径，便于其他服务访问）
function getFileUrl(filePath) {
  if (!filePath) return '';
  // 返回绝对路径，确保其他服务可以直接访问
  return path.resolve(filePath);
}

// 添加文件类型的知识（支持同名文件检测）
async function addFileKnowledge(fileData, isUpdate = false) {
  const { filePath, originalName, mimeType, business, scene, file_url, knowledge_id: inputKnowledgeId } = fileData;
  
  let existingKnowledge = null;
  let knowledgeId = inputKnowledgeId;
  let shouldUpdate = isUpdate;
  
  // 统一逻辑：如果不是更新操作且没有指定knowledge_id，检查数据库中是否存在同名文件（根据title判断）
  if (!shouldUpdate && !knowledgeId) {
    existingKnowledge = await dbService.getKnowledgeByTitle(originalName);
    
    // 如果数据库中已存在同名记录，返回给前端确认（不自动更新）
    if (existingKnowledge) {
      logger.info('发现同名文件记录，等待前端确认', { 
        knowledge_id: existingKnowledge.knowledge_id, 
        filename: originalName,
        existing_business: existingKnowledge.business,
        existing_scene: existingKnowledge.scene
      });
      return {
        exists: true,
        knowledge_id: existingKnowledge.knowledge_id,
        message: `文件 "${originalName}" 已存在于数据库中，是否要更新？`,
        existing: {
          business: existingKnowledge.business,
          scene: existingKnowledge.scene,
          file_size: existingKnowledge.file_size
        }
      };
    }
  }
  
  // 如果是指定了knowledge_id的更新操作，获取现有记录
  if (shouldUpdate && knowledgeId) {
    existingKnowledge = await dbService.getKnowledgeById(knowledgeId);
    if (!existingKnowledge) {
      throw new Error(`knowledge_id ${knowledgeId} 不存在`);
    }
  }
  
  // 获取文件大小
  const stats = await fs.stat(filePath);
  const fileSize = stats.size;
  
  // 确定文件类型
  const ext = path.extname(originalName).toLowerCase();
  let fileType = ext.replace('.', '');
  if (!fileType) {
    if (mimeType.includes('pdf')) fileType = 'pdf';
    else if (mimeType.includes('word') || mimeType.includes('document')) fileType = 'docx';
    else if (mimeType.includes('text')) fileType = 'txt';
    else if (mimeType.includes('markdown')) fileType = 'md';
    else fileType = 'unknown';
  }
  
  let finalFilePath = filePath;
  let finalFileUrl = file_url;
  
  if (shouldUpdate && knowledgeId && existingKnowledge) {
    // 更新操作
    
    // 1. 覆盖uploads中的文件
    if (existingKnowledge.file_url && existingKnowledge.type !== 'json') {
      try {
        // file_url 现在存储的是绝对路径，直接使用
        const oldFilePath = path.isAbsolute(existingKnowledge.file_url) 
          ? existingKnowledge.file_url 
          : path.join(config.uploadDir, existingKnowledge.file_url.replace(/^\/uploads\//, '').replace(/^uploads\//, ''));
        const normalizedOldPath = path.resolve(oldFilePath);
        const normalizedNewPath = path.resolve(filePath);
        
        // 如果新文件和旧文件路径不同，需要覆盖
        if (normalizedOldPath !== normalizedNewPath) {
          // 确保旧文件所在目录存在
          await fs.ensureDir(path.dirname(oldFilePath));
          // 复制新文件覆盖旧文件
          await fs.copy(filePath, oldFilePath, { overwrite: true });
          finalFilePath = oldFilePath;
          finalFileUrl = getFileUrl(oldFilePath); // 使用绝对路径
          logger.info('已覆盖旧文件', { oldFile: oldFilePath, newFile: filePath });
          
          // 删除临时上传的新文件（如果不同）
          if (normalizedOldPath !== normalizedNewPath) {
            try {
              await fs.remove(filePath);
            } catch (error) {
              logger.warn('删除临时文件失败', { filePath, error: error.message });
            }
          }
        } else {
          // 路径相同，直接使用（保持绝对路径）
          finalFileUrl = getFileUrl(oldFilePath);
        }
      } catch (error) {
        logger.warn('覆盖文件失败，使用新文件路径', { error: error.message });
        finalFileUrl = file_url || getFileUrl(filePath);
      }
    } else {
      finalFileUrl = file_url || getFileUrl(filePath);
    }
    
    // 2. 删除旧的向量数据
    await vectorStore.removeWhere(
      (record) => record.metadata?.knowledgeId === knowledgeId.toString()
    );
    logger.info('已删除旧的向量数据', { knowledgeId });
    
    // 3. 更新MySQL记录（包括updated_at，场景等字段）
    await dbService.updateKnowledge(knowledgeId, {
      type: fileType,
      file_size: fileSize,
      file_url: finalFileUrl,
      title: originalName,
      business, // 更新场景信息（如果有变化）
      scene
      // 状态保持不变；refer_num 不在这里更新
    });
    
    logger.info('MySQL记录已更新，开始重建向量数据', { knowledgeId, filename: originalName });
  } else {
    // 新建操作：保存到MySQL（status 由 dbService 默认处理）
    knowledgeId = await dbService.insertKnowledge({
      type: fileType,
      file_size: fileSize,
      file_url: file_url || getFileUrl(filePath),
      title: originalName,
      content: null,
      business,
      scene
      // 不显式传 status，让 dbService 使用默认值
    });
  }
  
  // 4. 保存到向量数据库（重建向量，更新元数据）
  const fileUrlForVector = shouldUpdate && existingKnowledge
    ? finalFileUrl
    : (file_url || getFileUrl(filePath));
  const statusForVector =
    (shouldUpdate && existingKnowledge && existingKnowledge.status) || '生效中';

  const chunkCount = await ingestFile({
    filePath: shouldUpdate && existingKnowledge ? finalFilePath : filePath,
    originalName,
    mimeType,
    uploadedBy: 'system',
    customMetadata: {
      knowledgeId: knowledgeId.toString(),
      business,
      scene,
      title: originalName,
      file_url: fileUrlForVector,
      status: statusForVector,
      isActive: statusForVector === '生效中'
    }
  });
  
  logger.info(shouldUpdate ? '文件知识更新成功' : '文件知识添加成功', { 
    knowledgeId, 
    filename: originalName, 
    chunks: chunkCount 
  });
  
  return { 
    knowledge_id: knowledgeId, 
    chunks: chunkCount,
    updated: shouldUpdate
  };
}

// 异步处理：只创建MySQL记录，不进行向量化（向量化在队列中处理）
async function addFileKnowledgeAsync(fileData, isUpdate = false) {
  const { filePath, originalName, mimeType, business, scene, file_url, knowledge_id: inputKnowledgeId } = fileData;
  
  let existingKnowledge = null;
  let knowledgeId = inputKnowledgeId;
  let shouldUpdate = isUpdate;
  
  // 统一逻辑：如果不是更新操作且没有指定knowledge_id，检查数据库中是否存在同名文件（根据title判断）
  // 新需求：如果存在同名文件，直接走“更新覆盖”逻辑（不再让前端二次确认）
  if (!shouldUpdate && !knowledgeId) {
    existingKnowledge = await dbService.getKnowledgeByTitle(originalName);
    
    if (existingKnowledge) {
      knowledgeId = existingKnowledge.knowledge_id;
      shouldUpdate = true;
      logger.info('发现同名文件记录，自动走更新覆盖逻辑', { 
        knowledge_id: existingKnowledge.knowledge_id, 
        filename: originalName,
        existing_business: existingKnowledge.business,
        existing_scene: existingKnowledge.scene
      });
    }
  }
  
  // 如果是指定了knowledge_id的更新操作，获取现有记录
  if (shouldUpdate && knowledgeId) {
    existingKnowledge = await dbService.getKnowledgeById(knowledgeId);
    if (!existingKnowledge) {
      throw new Error(`knowledge_id ${knowledgeId} 不存在`);
    }
  }
  
  // 获取文件大小
  const stats = await fs.stat(filePath);
  const fileSize = stats.size;
  
  // 确定文件类型
  const ext = path.extname(originalName).toLowerCase();
  let fileType = ext.replace('.', '');
  if (!fileType) {
    if (mimeType.includes('pdf')) fileType = 'pdf';
    else if (mimeType.includes('word') || mimeType.includes('document')) fileType = 'docx';
    else if (mimeType.includes('text')) fileType = 'txt';
    else if (mimeType.includes('markdown')) fileType = 'md';
    else fileType = 'unknown';
  }
  
  let finalFilePath = filePath;
  let finalFileUrl = file_url;
  
  if (shouldUpdate && knowledgeId && existingKnowledge) {
    // 更新操作：覆盖uploads中的文件
    if (existingKnowledge.file_url && existingKnowledge.type !== 'json') {
      try {
        // file_url 现在存储的是绝对路径，直接使用
        const oldFilePath = path.isAbsolute(existingKnowledge.file_url) 
          ? existingKnowledge.file_url 
          : path.join(config.uploadDir, existingKnowledge.file_url.replace(/^\/uploads\//, '').replace(/^uploads\//, ''));
        const normalizedOldPath = path.resolve(oldFilePath);
        const normalizedNewPath = path.resolve(filePath);
        
        if (normalizedOldPath !== normalizedNewPath) {
          // 确保旧文件所在目录存在
          await fs.ensureDir(path.dirname(oldFilePath));
          // 复制新文件覆盖旧文件
          await fs.copy(filePath, oldFilePath, { overwrite: true });
          finalFilePath = oldFilePath;
          finalFileUrl = getFileUrl(oldFilePath); // 使用绝对路径
          logger.info('已覆盖旧文件', { oldFile: oldFilePath, newFile: filePath });
          
          // 删除临时上传的新文件
          try {
            await fs.remove(filePath);
          } catch (error) {
            logger.warn('删除临时文件失败', { filePath, error: error.message });
          }
        } else {
          finalFileUrl = getFileUrl(oldFilePath); // 使用绝对路径
        }
      } catch (error) {
        logger.warn('覆盖文件失败，使用新文件路径', { error: error.message });
        finalFileUrl = file_url || getFileUrl(filePath);
      }
    } else {
      finalFileUrl = file_url || getFileUrl(filePath);
    }
    
    // 更新MySQL记录（包括updated_at，场景等字段）
    await dbService.updateKnowledge(knowledgeId, {
      type: fileType,
      file_size: fileSize,
      file_url: finalFileUrl,
      title: originalName,
      business, // 更新场景信息（如果有变化）
      scene
    });
    logger.info('MySQL记录已更新，等待向量化处理', { knowledgeId, filename: originalName });
  } else {
    // 新建MySQL记录
    knowledgeId = await dbService.insertKnowledge({
      type: fileType,
      file_size: fileSize,
      file_url: file_url || getFileUrl(filePath),
      title: originalName,
      content: null,
      business,
      scene
    });
    logger.info('MySQL记录已创建，等待向量化处理', { knowledgeId, filename: originalName });
  }
  
  return {
    knowledge_id: knowledgeId,
    updated: shouldUpdate,
    queued: true, // 标记为已加入队列
    filePath: finalFilePath, // 返回最终使用的文件路径（可能是覆盖后的路径）
    fileUrl: finalFileUrl
  };
}

// 完成文件知识的向量化处理（在队列消费者中调用）
async function completeFileKnowledgeProcessing(knowledgeId, fileData) {
  const { filePath, originalName, mimeType, business, scene, isUpdate } = fileData;
  
  try {
    // 读取当前数据库中的最新元数据，保证与向量库、文件系统一致
    let current = null;
    try {
      current = await dbService.getKnowledgeById(knowledgeId);
    } catch (e) {
      logger.warn('获取知识元数据失败，将使用任务中的元数据', {
        knowledgeId,
        error: e.message
      });
    }

    const effectiveBusiness = current && current.business != null ? current.business : business;
    const effectiveScene = current && current.scene != null ? current.scene : scene;
    const effectiveTitle = current && current.title ? current.title : originalName;
    const fileUrl = getFileUrl(filePath);
    const effectiveStatus =
      (current && current.status) || '生效中';

    // 如果是更新操作，先删除旧的向量数据（在队列中执行，不阻塞响应）
    if (isUpdate) {
      try {
        await vectorStore.removeWhere(
          (record) => record.metadata?.knowledgeId === knowledgeId.toString()
        );
        logger.info('已删除旧的向量数据，准备重建', { knowledgeId });
      } catch (error) {
        logger.warn('删除旧向量数据失败', { knowledgeId, error: error.message });
        // 继续处理，不因为删除失败而中断
      }
    }
    
    // 进行向量化处理
    const chunkCount = await ingestFile({
      filePath,
      originalName: effectiveTitle,
      mimeType,
      uploadedBy: 'system',
      customMetadata: {
        knowledgeId: knowledgeId.toString(),
        business: effectiveBusiness,
        scene: effectiveScene,
        title: effectiveTitle,
        file_url: fileUrl,
        status: effectiveStatus,
        isActive: effectiveStatus === '生效中'
      }
    });
    
    logger.info('文件知识向量化处理完成', { 
      knowledgeId, 
      filename: effectiveTitle, 
      chunks: chunkCount,
      isUpdate: isUpdate ? '更新' : '新建'
    });
    
    // 发送SSE通知
    sseService.notifyKnowledgeProcessed({
      knowledge_id: knowledgeId,
      chunks: chunkCount,
      status: 'completed',
      message: isUpdate ? '文件更新完成' : '文件处理完成',
      filename: originalName
    });
    
    return {
      knowledge_id: knowledgeId,
      chunks: chunkCount,
      status: 'completed'
    };
  } catch (error) {
    logger.error('文件知识向量化处理失败', { 
      knowledgeId, 
      filename: originalName,
      error: error.message 
    });
    
    // 发送失败通知
    sseService.notifyKnowledgeFailed({
      knowledge_id: knowledgeId,
      error: error.message,
      message: '文件处理失败',
      filename: originalName
    });
    
    throw error;
  }
}


// 添加JSON类型的知识（根据title检查是否存在，如果存在则返回给前端确认）
async function addJsonKnowledge(jsonData, isUpdate = false, knowledge_id = null) {
  const { content, title, business, scene } = jsonData;
  
  if (!content) {
    throw new Error('content 不能为空');
  }
  
  if (!title) {
    throw new Error('title 不能为空');
  }
  
  // 将JSON内容转为文本用于向量化
  let jsonText = typeof content === 'string' 
    ? content 
    : JSON.stringify(content, null, 2);
  
  // 清洗 JSON 文本（去除多余空格、特殊字符等）
  jsonText = TextCleaner.cleanText(jsonText, false);
  
  // 如果不是更新操作，检查是否存在相同title的记录
  const existingKnowledge = !isUpdate && !knowledge_id 
    ? await dbService.getKnowledgeByTitle(title)
    : null;
  
  let knowledgeId = knowledge_id;
  let shouldUpdate = isUpdate;
  
  if (!shouldUpdate && !knowledgeId && existingKnowledge && existingKnowledge.type === 'json') {
    // 存在相同title的JSON记录，返回给前端确认（不自动更新）
    logger.info('发现同名JSON记录，等待前端确认', { knowledge_id: existingKnowledge.knowledge_id, title });
    return {
      exists: true,
      knowledge_id: existingKnowledge.knowledge_id,
      message: `JSON内容 "${title}" 已存在于数据库中，是否要更新？`
    };
  }
  
  // 如果是更新操作
  if (shouldUpdate && knowledgeId) {
    const existing = await dbService.getKnowledgeById(knowledgeId);
    if (!existing) {
      throw new Error(`knowledge_id ${knowledgeId} 不存在`);
    }
    
    // 1. 删除旧的向量数据
    await vectorStore.removeWhere(
      (record) => record.metadata?.knowledgeId === knowledgeId.toString()
    );
    
    // 2. 删除旧的JSON文件
    if (existing.file_url) {
      try {
        // file_url 现在存储的是绝对路径，直接使用
        const oldJsonPath = path.isAbsolute(existing.file_url) 
          ? existing.file_url 
          : path.join(config.uploadDir, existing.file_url.replace(/^\/uploads\//, '').replace(/^uploads\//, ''));
        if (await fs.pathExists(oldJsonPath)) {
          await fs.remove(oldJsonPath);
          logger.info('已删除旧的JSON文件', { oldFile: oldJsonPath });
        }
      } catch (error) {
        logger.warn('删除旧JSON文件失败', { error: error.message });
      }
    }
    
    // 3. 更新MySQL记录（保留refer_num）
    await dbService.updateKnowledge(knowledgeId, {
      file_size: Buffer.byteLength(jsonText, 'utf8'),
      content: content,
      business,
      scene
      // refer_num 保持不变
    });
  } else {
    // 不存在，创建新记录
    knowledgeId = await dbService.insertKnowledge({
      type: 'json',
      file_size: Buffer.byteLength(jsonText, 'utf8'),
      file_url: '', // JSON类型没有外部URL
      title,
      content: content, // 存储完整的JSON对象
      business,
      scene
    });
  }
  
  // 保存JSON文件到本地（使用 knowledgeId + 标题 命名）
  const { filePath, relativePath } = await saveJsonFile(content, knowledgeId, title);

  // 生成带 uploads/ 前缀的 storagePath，便于和 file_url 对齐
  const fileUrl = getFileUrl(filePath); // 形如 /uploads/json/46_xxx.json
  const storagePath = fileUrl.replace(/^\//, ''); // uploads/json/46_xxx.json
  
  // 保存到向量数据库
  const chunkCount = await ingestRawText({
    text: jsonText,
    title,
    tags: [],
    createdBy: 'system',
    customMetadata: {
      knowledgeId: knowledgeId.toString(),
      business,
      scene,
      storagePath,
      status: '生效中',
      isActive: true,
      sourceType: 'json'
    }
  });
  
  // 更新MySQL中的file_url
  await dbService.updateKnowledge(knowledgeId, {
    file_url: getFileUrl(filePath)
  });
  
  logger.info(shouldUpdate ? 'JSON知识更新成功' : 'JSON知识添加成功', { knowledgeId, title, chunks: chunkCount });
  
  return { knowledge_id: knowledgeId, chunks: chunkCount, updated: shouldUpdate };
}

// 更新文件知识
async function updateFileKnowledge(knowledgeId, updates) {
  const current = await dbService.getKnowledgeById(knowledgeId);
  if (!current) {
    throw new Error(`knowledge_id ${knowledgeId} 不存在`);
  }
  
  if (current.type === 'json') {
    throw new Error('不能使用文件更新方法来更新JSON类型的知识');
  }
  
  const { filePath, originalName, mimeType, title, business, scene, file_url, ...otherUpdates } = updates;
  
  // 如果提供了新文件，需要替换
  if (filePath && originalName) {
    // 删除旧的向量数据
    await vectorStore.removeWhere(
      (record) => record.metadata?.knowledgeId === knowledgeId.toString()
    );
    
    // 重新处理文件
    const text = await extractTextFromFile(filePath, originalName);
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;
    
    // 更新MySQL
    await dbService.updateKnowledge(knowledgeId, {
      ...otherUpdates,
      title: title || originalName,
      file_size: fileSize,
      file_url: file_url || getFileUrl(filePath),
      business,
      scene
    });
    
    // 重新添加到向量数据库
    const relativePath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
    await ingestFile({
      filePath,
      originalName: title || originalName,
      mimeType,
      uploadedBy: 'system',
      customMetadata: {
        knowledgeId: knowledgeId.toString(),
        business,
        scene
      }
    });
    
    logger.info('文件知识更新成功（文件已替换）', { knowledgeId });
  } else {
    // 只更新元数据
    await dbService.updateKnowledge(knowledgeId, {
      ...otherUpdates,
      title,
      business,
      scene,
      file_url
    });
    
    logger.info('文件知识更新成功（仅元数据）', { knowledgeId });
  }
}

// 更新JSON知识
async function updateJsonKnowledge(knowledgeId, updates) {
  const current = await dbService.getKnowledgeById(knowledgeId);
  if (!current) {
    throw new Error(`knowledge_id ${knowledgeId} 不存在`);
  }
  
  if (current.type !== 'json') {
    throw new Error('不能使用JSON更新方法来更新文件类型的知识');
  }
  
  const { content, title, business, scene, ...otherUpdates } = updates;
  
  // 如果content有变化，需要更新向量数据库
  if (content) {
    // 删除旧的向量数据
    await vectorStore.removeWhere(
      (record) => record.metadata?.knowledgeId === knowledgeId.toString()
    );
    
    const jsonText = typeof content === 'string' 
      ? content 
      : JSON.stringify(content, null, 2);
    
    // 更新本地JSON文件
    const jsonDir = path.join(config.uploadDir, 'json');
    const filename = `knowledge_${knowledgeId}.json`;
    const filePath = path.join(jsonDir, filename);
    
    const jsonString = typeof content === 'string' 
      ? content 
      : JSON.stringify(content, null, 2);
    
    await fs.writeFile(filePath, jsonString, 'utf8');
    
    const relativePath = path.relative(config.uploadDir, filePath).replace(/\\/g, '/');
    
    // 重新添加到向量数据库
    await ingestRawText({
      text: jsonText,
      title: title || current.title,
      tags: [],
      createdBy: 'system',
      customMetadata: {
        knowledgeId: knowledgeId.toString(),
        business,
        scene,
        storagePath: relativePath
      }
    });
    
    // 更新MySQL
    await dbService.updateKnowledge(knowledgeId, {
      ...otherUpdates,
      title: title || current.title,
      content: content,
      file_size: Buffer.byteLength(jsonText, 'utf8'),
      file_url: getFileUrl(filePath),
      business,
      scene
    });
    
    logger.info('JSON知识更新成功（内容已替换）', { knowledgeId });
  } else {
    // 只更新元数据
    await dbService.updateKnowledge(knowledgeId, {
      ...otherUpdates,
      title,
      business,
      scene
    });
    
    logger.info('JSON知识更新成功（仅元数据）', { knowledgeId });
  }
}

// 删除知识
async function deleteKnowledge(knowledgeId) {
  const current = await dbService.getKnowledgeById(knowledgeId);
  if (!current) {
    throw new Error(`knowledge_id ${knowledgeId} 不存在`);
  }


  
  // 1. 从向量数据库删除
  await vectorStore.removeWhere(
    (record) => record.metadata?.knowledgeId === knowledgeId.toString()
  );
  
  // 2. 从MySQL删除
  await dbService.deleteKnowledge(knowledgeId);


  
  // 3. 删除本地物理文件（所有类型）
  if (current.file_url) {
    try {
      // file_url 现在存储的是绝对路径，直接使用
      const filePath = path.isAbsolute(current.file_url) 
        ? current.file_url 
        : path.join(config.uploadDir, current.file_url.replace(/^\/uploads\//, '').replace(/^uploads\//, ''));
      
      // 检查文件是否存在
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        logger.info('已删除物理文件', { knowledgeId, filePath });
      } else {
        logger.warn('物理文件不存在，跳过删除', { knowledgeId, filePath: relativePath });
      }
    } catch (error) {
      logger.warn('删除物理文件失败', { knowledgeId, error: error.message });
    }
  }
  
  logger.info('知识删除成功', { knowledgeId });
}

module.exports = {
  addFileKnowledge,
  addFileKnowledgeAsync,
  completeFileKnowledgeProcessing,
  addJsonKnowledge,
  updateFileKnowledge,
  updateJsonKnowledge,
  deleteKnowledge,
  getFileUrl,
  saveJsonFile
};

