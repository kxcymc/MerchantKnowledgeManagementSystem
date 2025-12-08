const logger = require('../../../shared/utils/logger');

/**
 * 多模态输入处理工具
 * 提供插槽式的图像、音频、文件处理函数
 */

/**
 * 处理图片文件，转换为多模态消息格式
 * @param {Object} imageFile - Multer文件对象 { buffer, mimetype, originalname }
 * @returns {Object|null} 多模态消息对象 { type: 'image_url', image_url: { url: string } } 或 null
 */
function processImageFile(imageFile) {
  if (!imageFile || !imageFile.buffer) {
    return null;
  }

  try {
    const imageBuffer = imageFile.buffer;
    const base64Image = imageBuffer.toString('base64');
    const imageMimeType = imageFile.mimetype || 'image/jpeg';

    logger.info('处理图片文件', {
      size: imageBuffer.length,
      mimetype: imageMimeType,
      name: imageFile.originalname
    });

    return {
      type: 'image_url',
      image_url: {
        url: `data:${imageMimeType};base64,${base64Image}`
      }
    };
  } catch (error) {
    logger.error('处理图片文件失败', { error: error.message });
    throw new Error(`图片处理失败: ${error.message}`);
  }
}

/**
 * 生成图片信息对象（用于前端显示）
 * @param {Object} imageFile - Multer文件对象 { buffer, mimetype, originalname, size }
 * @returns {Object|null} 图片信息对象 { name, type, size, dataUrl } 或 null
 */
function generateImageInfo(imageFile) {
  if (!imageFile || !imageFile.buffer) {
    return null;
  }

  try {
    const base64Image = imageFile.buffer.toString('base64');
    const imageMimeType = imageFile.mimetype || 'image/jpeg';
    const imageDataUrl = `data:${imageMimeType};base64,${base64Image}`;

    return {
      name: imageFile.originalname,
      type: imageMimeType,
      size: imageFile.size,
      dataUrl: imageDataUrl
    };
  } catch (error) {
    logger.error('生成图片信息失败', { error: error.message });
    return null;
  }
}

/**
 * 生成音频信息对象（用于前端显示和播放）
 * @param {Object} audioFile - Multer文件对象 { buffer, mimetype, originalname, size }
 * @returns {Object|null} 音频信息对象 { name, type, size, dataUrl } 或 null
 */
function generateAudioInfo(audioFile) {
  if (!audioFile || !audioFile.buffer) {
    return null;
  }

  try {
    const base64Audio = audioFile.buffer.toString('base64');
    const audioMimeType = audioFile.mimetype || 'audio/wav';
    const audioDataUrl = `data:${audioMimeType};base64,${base64Audio}`;

    return {
      name: audioFile.originalname,
      type: audioMimeType,
      size: audioFile.size,
      dataUrl: audioDataUrl
    };
  } catch (error) {
    logger.error('生成音频信息失败', { error: error.message });
    return null;
  }
}

/**
 * 构建存储格式的content（用于数据库存储）
 * 格式：如果有图片、音频或附件，存储JSON字符串；如果只有文本，直接存储文本（向后兼容）
 * @param {Object} options - 选项对象
 * @param {string} options.text - 文本内容
 * @param {Object} options.imageFile - 图片文件对象（可选，原始文件对象）
 * @param {Object} options.audioFile - 音频文件对象（可选，原始文件对象）
 * @param {Object} options.savedImageFile - 已保存的图片文件信息（可选，{ url, filename, originalName, mimeType, size, path }）
 * @param {Object} options.savedAudioFile - 已保存的音频文件信息（可选，{ url, filename, originalName, mimeType, size, path }）
 * @param {Array<Object>} options.attachments - 附件文件信息数组（可选）[{ url, filename, originalName, mimeType, size }]
 * @returns {string} 存储格式的content字符串
 */
function buildStorageContent({ text, imageFile, audioFile, savedImageFile, savedAudioFile, attachments }) {
  const hasImage = !!(savedImageFile || imageFile);
  const hasAudio = !!(savedAudioFile || audioFile);
  const hasAttachments = attachments && attachments.length > 0;
  const hasText = text && text.trim().length > 0;

  // 如果只有文本，直接返回文本（向后兼容）
  if (!hasImage && !hasAudio && !hasAttachments) {
    return text || '';
  }

  // 如果有图片、音频或附件，构建JSON格式
  const storageData = {
    text: text || '',
    image: null,
    audio: null,
    attachments: []
  };

  // 优先使用已保存的文件信息（包含URL），否则使用原始文件对象（生成base64 data URL）
  if (savedImageFile) {
    // 使用已保存的文件信息（URL格式）
    storageData.image = {
      url: savedImageFile.url,
      filename: savedImageFile.filename,
      originalName: savedImageFile.originalName,
      mimeType: savedImageFile.mimeType,
      size: savedImageFile.size
    };
  } else if (imageFile) {
    // 向后兼容：使用原始文件对象生成base64 data URL
    const imageInfo = generateImageInfo(imageFile);
    if (imageInfo) {
      storageData.image = imageInfo.dataUrl;
    }
  }

  if (savedAudioFile) {
    // 使用已保存的文件信息（URL格式）
    storageData.audio = {
      url: savedAudioFile.url,
      filename: savedAudioFile.filename,
      originalName: savedAudioFile.originalName,
      mimeType: savedAudioFile.mimeType,
      size: savedAudioFile.size
    };
  } else if (audioFile) {
    // 向后兼容：使用原始文件对象生成base64 data URL
    const audioInfo = generateAudioInfo(audioFile);
    if (audioInfo) {
      storageData.audio = audioInfo.dataUrl;
    }
  }

  if (hasAttachments) {
    storageData.attachments = attachments.map(att => ({
      url: att.url,
      filename: att.filename,
      originalName: att.originalName,
      mimeType: att.mimeType,
      size: att.size
    }));
  }

  return JSON.stringify(storageData);
}

/**
 * 解析存储格式的content（从数据库读取后解析）
 * @param {string} content - 存储的content字符串（可能是纯文本或JSON字符串）
 * @returns {Object} 解析结果 { text: string, image: Object|null, audio: Object|null, attachments: Array, isMultimodal: boolean }
 * 注意：image和audio可能是URL对象（{url, filename, ...}）或data URL字符串（向后兼容）
 */
function parseStorageContent(content) {
  if (!content) {
    return { text: '', image: null, audio: null, attachments: [], isMultimodal: false };
  }

  // 尝试解析JSON
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === 'object' && (parsed.image || parsed.audio || parsed.attachments)) {
      // 是多模态格式
      // 处理图片：可能是URL对象或data URL字符串（向后兼容）
      let image = null;
      if (parsed.image) {
        if (typeof parsed.image === 'string') {
          // 向后兼容：data URL字符串
          image = parsed.image;
        } else if (typeof parsed.image === 'object' && parsed.image.url) {
          // 新格式：URL对象
          image = parsed.image;
        }
      }
      
      // 处理音频：可能是URL对象或data URL字符串（向后兼容）
      let audio = null;
      if (parsed.audio) {
        if (typeof parsed.audio === 'string') {
          // 向后兼容：data URL字符串
          audio = parsed.audio;
        } else if (typeof parsed.audio === 'object' && parsed.audio.url) {
          // 新格式：URL对象
          audio = parsed.audio;
        }
      }
      
      // 即使是从JSON解析出来的text，也可能包含旧数据中的解析内容，需要过滤
      let cleanedText = parsed.text || '';
      // 移除解析后的文件内容，避免在前端显示
      cleanedText = cleanedText.replace(/\[图片内容[：:][\s\S]*?\]/g, '');
      cleanedText = cleanedText.replace(/\[语音内容[：:][\s\S]*?\]/g, '');
      cleanedText = cleanedText.replace(/\[附件文件内容[：:][\s\S]*?\]/g, '');
      // 移除"总结文件:文件名 内容:"这样的格式（附件解析后的内容）
      cleanedText = cleanedText.replace(/总结文件[：:][^\n]*\s*内容[：:][\s\S]*?(?=\n\n|\n[A-Z]|$)/g, '');
      cleanedText = cleanedText.replace(/文件[：:][^\n]*\n内容[：:][\s\S]*?(?=\n\n|\n文件[：:]|$)/g, '');
      // 移除"文件：文件名\n内容：..."格式（更通用的匹配，匹配到段落结束或文档结束）
      cleanedText = cleanedText.replace(/文件[：:][^\n]+\n内容[：:][\s\S]*?(?=\n\n|$)/g, '');
      // 移除以"文件："开头，后面跟着文件名和"内容："的大段文本（包括单行和多行格式）
      cleanedText = cleanedText.replace(/文件[：:][^\n]+\s*内容[：:][\s\S]*?(?=\n\n|$)/g, '');
      // 清理多余的空白行
      cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n');
      cleanedText = cleanedText.trim();
      
      return {
        text: cleanedText,
        image: image,
        audio: audio,
        attachments: parsed.attachments || [],
        isMultimodal: true
      };
    }
  } catch (e) {
    // 不是JSON格式，当作纯文本处理
  }

  // 纯文本格式（向后兼容）
  // 注意：如果旧数据中包含解析内容（如 [图片内容：...]、[语音内容：...] 等），需要过滤掉
  let cleanedText = content || '';
  // 移除解析后的文件内容，避免在前端显示
  cleanedText = cleanedText.replace(/\[图片内容[：:][\s\S]*?\]/g, '');
  cleanedText = cleanedText.replace(/\[语音内容[：:][\s\S]*?\]/g, '');
  cleanedText = cleanedText.replace(/\[附件文件内容[：:][\s\S]*?\]/g, '');
  // 移除"总结文件:文件名 内容:"这样的格式（附件解析后的内容）
  cleanedText = cleanedText.replace(/总结文件[：:][^\n]*\s*内容[：:][\s\S]*?(?=\n\n|\n[A-Z]|$)/g, '');
  cleanedText = cleanedText.replace(/文件[：:][^\n]*\n内容[：:][\s\S]*?(?=\n\n|\n文件[：:]|$)/g, '');
  // 移除"文件：文件名\n内容：..."格式（更通用的匹配，匹配到段落结束或文档结束）
  cleanedText = cleanedText.replace(/文件[：:][^\n]+\n内容[：:][\s\S]*?(?=\n\n|$)/g, '');
  // 移除以"文件："开头，后面跟着文件名和"内容："的大段文本（包括单行和多行格式）
  cleanedText = cleanedText.replace(/文件[：:][^\n]+\s*内容[：:][\s\S]*?(?=\n\n|$)/g, '');
  // 清理多余的空白行
  cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n');
  cleanedText = cleanedText.trim();
  
  return {
    text: cleanedText,
    image: null,
    audio: null,
    attachments: [],
    isMultimodal: false
  };
}

/**
 * 处理音频文件，转换为多模态消息格式
 * @param {Object} audioFile - Multer文件对象 { buffer, mimetype, originalname }
 * @returns {Object|null} 多模态消息对象 { type: 'input_audio', input_audio: { data: string, format: string } } 或 null
 */
function processAudioFile(audioFile) {
  if (!audioFile || !audioFile.buffer) {
    return null;
  }

  try {
    const audioBuffer = audioFile.buffer;
    const base64Audio = audioBuffer.toString('base64');
    const audioFormat = audioFile.mimetype.split('/')[1] || 'wav';
    const audioMimeType = audioFile.mimetype || `audio/${audioFormat}`;

    logger.info('处理音频文件', {
      size: audioBuffer.length,
      format: audioFormat,
      mimetype: audioMimeType,
      name: audioFile.originalname
    });

    return {
      type: 'input_audio',
      input_audio: {
        data: base64Audio, // 纯base64字符串
        format: audioFormat
      }
    };
  } catch (error) {
    logger.error('处理音频文件失败', { error: error.message });
    throw new Error(`音频处理失败: ${error.message}`);
  }
}

/**
 * 处理文本文件（如PDF、DOCX等），转换为文本内容
 * @param {Object} file - Multer文件对象 { buffer, mimetype, originalname }
 * @returns {Promise<string>} 文件内容文本
 */
async function processTextFile(file) {
  if (!file || !file.buffer) {
    return '';
  }

  try {
    // 这里可以扩展支持PDF、DOCX等文件解析
    // 目前简单返回文件名和提示
    logger.info('处理文本文件', {
      size: file.buffer.length,
      mimetype: file.mimetype,
      name: file.originalname
    });

    // TODO: 可以集成PDF解析、DOCX解析等
    return `[文件：${file.originalname}]`;
  } catch (error) {
    logger.error('处理文本文件失败', { error: error.message });
    throw new Error(`文件处理失败: ${error.message}`);
  }
}

/**
 * 构建多模态消息数组
 * @param {Object} options - 选项对象
 * @param {string} options.text - 文本内容（可选）
 * @param {Object} options.imageFile - 图片文件（可选）
 * @param {Object} options.audioFile - 音频文件（可选）
 * @param {Array<Object>} options.otherFiles - 其他文件数组（可选）
 * @returns {Array|null} 多模态消息数组，如果没有多模态内容则返回null
 */
function buildMultimodalMessage({ text, imageFile, audioFile, otherFiles }) {
  const messageParts = [];

  // 1. 添加图片
  if (imageFile) {
    const imageMsg = processImageFile(imageFile);
    if (imageMsg) {
      messageParts.push(imageMsg);
    }
  }

  // 2. 添加音频
  if (audioFile) {
    const audioMsg = processAudioFile(audioFile);
    if (audioMsg) {
      messageParts.push(audioMsg);
    }
  }

  // 3. 添加文本
  if (text && text.trim()) {
    messageParts.push({
      type: 'text',
      text: text.trim()
    });
  }

  // 4. 处理其他文件（目前作为文本提示）
  if (otherFiles && otherFiles.length > 0) {
    const fileNames = otherFiles.map(f => f.originalname).join('、');
    messageParts.push({
      type: 'text',
      text: `[附件：${fileNames}]`
    });
  }

  // 如果只有文本且没有其他内容，返回null（使用纯文本模式）
  if (messageParts.length === 0) {
    return null;
  }

  // 如果只有文本，返回null（使用纯文本模式）
  if (messageParts.length === 1 && messageParts[0].type === 'text') {
    return null;
  }

  return messageParts;
}

/**
 * 从多模态消息中提取文本内容
 * @param {Array|null} multimodalMessage - 多模态消息数组
 * @returns {string} 提取的文本内容
 */
function extractTextFromMultimodalMessage(multimodalMessage) {
  if (!multimodalMessage || !Array.isArray(multimodalMessage)) {
    return '';
  }

  const textParts = multimodalMessage
    .filter(item => item.type === 'text')
    .map(item => item.text);

  return textParts.join('\n');
}

/**
 * 验证输入：至少要有文本、图片或音频中的一种
 * @param {Object} options - 选项对象
 * @param {string} options.text - 文本内容
 * @param {Object} options.imageFile - 图片文件
 * @param {Object} options.audioFile - 音频文件
 * @returns {boolean} 是否有效
 */
function validateInput({ text, imageFile, audioFile }) {
  const hasText = text && text.trim().length > 0;
  const hasImage = !!imageFile;
  const hasAudio = !!audioFile;

  return hasText || hasImage || hasAudio;
}

module.exports = {
  processImageFile,
  processAudioFile,
  processTextFile,
  buildMultimodalMessage,
  extractTextFromMultimodalMessage,
  validateInput,
  generateImageInfo,
  generateAudioInfo,
  buildStorageContent,
  parseStorageContent
};

