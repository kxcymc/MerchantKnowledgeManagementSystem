const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const logger = require('../../../shared/utils/logger');
const config = require('../config');

/**
 * 文件存储服务
 * 负责保存上传的文件到本地文件夹，并管理文件元数据
 */
class FileStorageService {
  constructor() {
    // 文件存储目录（使用独立的chat-attachments目录，不与其他上传目录混用）
    this.storageDir = path.join(process.cwd(), 'uploads', 'chat-attachments');
    // 文件访问URL前缀
    this.urlPrefix = '/api/chat-files';
    
    // 确保存储目录存在（同步执行，确保在服务启动时就创建）
    this.ensureStorageDirSync();
  }
  
  /**
   * 同步确保存储目录存在（用于构造函数）
   */
  ensureStorageDirSync() {
    try {
      fs.ensureDirSync(this.storageDir);
      logger.info('文件存储目录已准备（同步）', { storageDir: this.storageDir });
    } catch (error) {
      logger.error('创建文件存储目录失败（同步）', { error: error.message, storageDir: this.storageDir });
      // 不抛出错误，允许后续异步创建
    }
  }

  /**
   * 确保存储目录存在
   */
  async ensureStorageDir() {
    try {
      await fs.ensureDir(this.storageDir);
      logger.info('文件存储目录已准备', { storageDir: this.storageDir });
    } catch (error) {
      logger.error('创建文件存储目录失败', { error: error.message, storageDir: this.storageDir });
      throw error;
    }
  }

  /**
   * 保存文件到本地存储
   * @param {Object} file - Multer文件对象 { buffer, originalname, mimetype, size }
   * @param {number} messageId - 消息ID（用于组织文件）
   * @returns {Promise<Object>} 文件信息 { url, filename, originalName, mimeType, size, path }
   */
  async saveFile(file, messageId) {
    try {
      if (!file || !file.buffer) {
        throw new Error('文件对象无效');
      }

      // 生成唯一文件名：messageId_timestamp_hash.extension
      const timestamp = Date.now();
      const hash = crypto.createHash('md5').update(file.buffer).digest('hex').substring(0, 8);
      const ext = path.extname(file.originalname) || this.getExtensionFromMimeType(file.mimetype);
      const filename = `${messageId}_${timestamp}_${hash}${ext}`;
      
      // 文件保存路径
      const filePath = path.join(this.storageDir, filename);
      
      // 保存文件
      await fs.writeFile(filePath, file.buffer);
      
      // 生成访问URL
      const url = `${this.urlPrefix}/${filename}`;
      
      const fileInfo = {
        url,
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: filePath,
        savedAt: new Date().toISOString()
      };
      
      logger.info('文件保存成功', { 
        messageId, 
        filename, 
        originalName: file.originalname,
        size: file.size 
      });
      
      return fileInfo;
    } catch (error) {
      logger.error('保存文件失败', { error: error.message, messageId });
      throw new Error(`保存文件失败: ${error.message}`);
    }
  }

  /**
   * 根据MIME类型获取文件扩展名
   */
  getExtensionFromMimeType(mimeType) {
    const mimeMap = {
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'text/plain': '.txt',
      'text/markdown': '.md',
      'application/json': '.json',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'audio/webm': '.webm',
      'audio/wav': '.wav',
      'audio/mp3': '.mp3',
      'audio/mpeg': '.mp3',
    };
    return mimeMap[mimeType] || '';
  }

  /**
   * 检查文件是否存在
   * @param {string} filename - 文件名
   * @returns {Promise<boolean>} 文件是否存在
   */
  async fileExists(filename) {
    try {
      const filePath = path.join(this.storageDir, filename);
      return await fs.pathExists(filePath);
    } catch (error) {
      logger.error('检查文件存在性失败', { error: error.message, filename });
      return false;
    }
  }

  /**
   * 获取文件路径
   * @param {string} filename - 文件名
   * @returns {string} 文件完整路径
   */
  getFilePath(filename) {
    return path.join(this.storageDir, filename);
  }

  /**
   * 获取文件信息（不读取文件内容）
   * @param {string} filename - 文件名
   * @returns {Promise<Object|null>} 文件信息 { size, mtime } 或 null
   */
  async getFileInfo(filename) {
    try {
      const filePath = this.getFilePath(filename);
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        mtime: stats.mtime,
        exists: true
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { exists: false };
      }
      logger.error('获取文件信息失败', { error: error.message, filename });
      return null;
    }
  }

  /**
   * 删除文件
   * @param {string} filename - 文件名
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteFile(filename) {
    try {
      const filePath = this.getFilePath(filename);
      await fs.remove(filePath);
      logger.info('文件已删除', { filename });
      return true;
    } catch (error) {
      logger.error('删除文件失败', { error: error.message, filename });
      return false;
    }
  }

  /**
   * 清理过期文件（根据创建时间）
   * @param {number} maxAgeDays - 最大保留天数，默认30天
   * @returns {Promise<number>} 删除的文件数量
   */
  async cleanupOldFiles(maxAgeDays = 30) {
    try {
      const files = await fs.readdir(this.storageDir);
      const now = Date.now();
      const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const filename of files) {
        const filePath = path.join(this.storageDir, filename);
        try {
          const stats = await fs.stat(filePath);
          const age = now - stats.mtime.getTime();
          
          if (age > maxAge) {
            await fs.remove(filePath);
            deletedCount++;
            logger.info('清理过期文件', { filename, ageDays: Math.floor(age / (24 * 60 * 60 * 1000)) });
          }
        } catch (error) {
          logger.warn('清理文件时出错', { filename, error: error.message });
        }
      }

      logger.info('文件清理完成', { deletedCount, totalFiles: files.length });
      return deletedCount;
    } catch (error) {
      logger.error('清理过期文件失败', { error: error.message });
      return 0;
    }
  }
}

module.exports = new FileStorageService();

