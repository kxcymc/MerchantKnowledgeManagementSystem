const fs = require('fs-extra');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const logger = require('../../../shared/utils/logger');

/**
 * 文件解析服务
 * 用于解析上传的附件文件（txt、word、pdf）内容
 */
class FileParserService {
  /**
   * 解析文件内容
   * @param {Object} fileInfo - 文件信息 { path, filename, mimeType, originalName }
   * @returns {Promise<string>} 解析出的文本内容
   */
  async parseFile(fileInfo) {
    try {
      const filePath = fileInfo.path;
      const mimeType = fileInfo.mimeType || '';
      const ext = path.extname(fileInfo.filename || fileInfo.originalName || '').toLowerCase();

      // 根据文件类型选择解析方法
      if (mimeType.includes('text/plain') || ext === '.txt') {
        return await this.parseTextFile(filePath);
      } else if (mimeType.includes('pdf') || ext === '.pdf') {
        return await this.parsePdfFile(filePath);
      } else if (
        mimeType.includes('wordprocessingml') || 
        mimeType.includes('msword') || 
        ext === '.docx' || 
        ext === '.doc'
      ) {
        return await this.parseWordFile(filePath);
      } else {
        logger.warn('不支持的文件类型', { mimeType, ext, filename: fileInfo.filename });
        return `[文件类型 ${ext || mimeType} 暂不支持解析，仅显示文件名：${fileInfo.originalName}]`;
      }
    } catch (error) {
      logger.error('文件解析失败', { 
        error: error.message, 
        filename: fileInfo.filename,
        originalName: fileInfo.originalName 
      });
      throw new Error(`文件解析失败: ${error.message}`);
    }
  }

  /**
   * 解析文本文件
   * 支持多种编码格式，优先尝试UTF-8，失败后尝试GBK/GB2312（中文编码）
   */
  async parseTextFile(filePath) {
    try {
      // 优先尝试UTF-8编码
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return content.trim();
      } catch (utf8Error) {
        // UTF-8失败，尝试GBK/GB2312编码（中文常见编码）
        try {
          const iconv = require('iconv-lite');
          const buffer = await fs.readFile(filePath);
          // 尝试GBK编码
          const content = iconv.decode(buffer, 'gbk');
          logger.info('文本文件使用GBK编码解析成功', { filePath });
          return content.trim();
        } catch (gbkError) {
          // GBK也失败，尝试GB2312
          try {
            const iconv = require('iconv-lite');
            const buffer = await fs.readFile(filePath);
            const content = iconv.decode(buffer, 'gb2312');
            logger.info('文本文件使用GB2312编码解析成功', { filePath });
            return content.trim();
          } catch (gb2312Error) {
            // 所有编码都失败，使用UTF-8并记录警告
            logger.warn('文本文件编码解析失败，使用UTF-8（可能乱码）', { 
              filePath,
              errors: {
                utf8: utf8Error.message,
                gbk: gbkError.message,
                gb2312: gb2312Error.message
              }
            });
            const buffer = await fs.readFile(filePath);
            return buffer.toString('utf-8').trim();
          }
        }
      }
    } catch (error) {
      logger.error('解析文本文件失败', { error: error.message, filePath });
      throw error;
    }
  }

  /**
   * 解析PDF文件
   */
  async parsePdfFile(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      const parsed = await pdfParse(buffer);
      const text = parsed.text?.trim() || '';
      
      if (text.length === 0) {
        logger.warn('PDF文件解析后文本为空', { filePath });
        return '[PDF文件解析后文本为空，可能是扫描版PDF]';
      }
      
      return text;
    } catch (error) {
      logger.error('解析PDF文件失败', { error: error.message, filePath });
      throw error;
    }
  }

  /**
   * 解析Word文件
   */
  async parseWordFile(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value?.trim() || '';
      
      if (text.length === 0) {
        logger.warn('Word文件解析后文本为空', { filePath });
        return '[Word文件解析后文本为空]';
      }
      
      return text;
    } catch (error) {
      logger.error('解析Word文件失败', { error: error.message, filePath });
      throw error;
    }
  }
}

module.exports = new FileParserService();

