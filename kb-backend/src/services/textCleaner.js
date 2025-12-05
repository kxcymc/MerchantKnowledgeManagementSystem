const logger = require('../utils/logger');

/**
 * 文本清洗工具类
 * 用于清洗提取的文本，去除多余空格、特殊字符等，但保留位置信息
 */
class TextCleaner {
  /**
   * 清洗单行文本（通用清洗）
   * @param {string} text - 原始文本
   * @returns {string} - 清洗后的文本
   */
  static cleanLine(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      // 1. 去除首尾空白
      .trim()
      // 2. 去除多余空格（保留单个空格）
      .replace(/\s+/g, ' ')
      // 3. 去除特殊控制字符（保留常见标点）
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      // 4. 标准化引号（可选，根据需求决定是否启用）
      // .replace(/[""]/g, '"')
      // .replace(/['']/g, "'")
      // 5. 去除零宽字符
      .replace(/[\u200B-\u200D\uFEFF]/g, '');
  }

  /**
   * 清洗 OCR 识别的文本（更严格的清洗）
   * @param {string} text - OCR 识别的文本
   * @returns {string} - 清洗后的文本
   */
  static cleanOcrText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      // 1. 去除首尾空白
      .trim()
      // 2. 去除多余空格（保留单个空格）
      .replace(/\s+/g, ' ')
      // 3. 去除特殊控制字符
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      // 4. 去除零宽字符
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // 5. 去除常见的 OCR 错误字符（根据实际情况调整）
      // 例如：全角/半角混用、特殊符号等
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s，。！？；：、""''（）【】《》·—…]/g, '')
      // 6. 修复常见的 OCR 错误（可选，根据实际情况调整）
      // 例如：0 和 O 的混淆等，这里暂时不处理，因为可能误判
      // .replace(/\b0([a-z])\b/gi, 'O$1') // 谨慎使用
      // 7. 去除行首行尾的标点符号（可选）
      // .replace(/^[，。！？；：、]+|[，。！？；：、]+$/g, '')
      .trim();
  }

  /**
   * 清洗带位置信息的文本数据
   * 清洗文本内容，但保留 page 和 line 信息
   * @param {Array<{page: number, line: number, text: string}>} pageLineData - 带位置信息的文本数据
   * @param {boolean} isOcr - 是否为 OCR 识别的文本
   * @returns {Array<{page: number, line: number, text: string}>} - 清洗后的数据
   */
  static cleanPageLineData(pageLineData, isOcr = false) {
    if (!Array.isArray(pageLineData) || pageLineData.length === 0) {
      return pageLineData || [];
    }

    const cleanFunction = isOcr ? this.cleanOcrText : this.cleanLine;
    const cleaned = [];

    for (const item of pageLineData) {
      const cleanedText = cleanFunction(item.text || '');
      
      // 只保留非空文本
      if (cleanedText && cleanedText.length > 0) {
        cleaned.push({
          page: item.page || 1,
          line: item.line || 1,
          text: cleanedText
        });
      }
    }

    // 如果清洗后全部为空，至少保留第一项（避免后续处理出错）
    if (cleaned.length === 0 && pageLineData.length > 0) {
      const firstItem = pageLineData[0];
      cleaned.push({
        page: firstItem.page || 1,
        line: firstItem.line || 1,
        text: '[空内容]'
      });
    }

    return cleaned;
  }

  /**
   * 清洗纯文本（不带位置信息）
   * @param {string} text - 原始文本
   * @param {boolean} isOcr - 是否为 OCR 识别的文本
   * @returns {string} - 清洗后的文本
   */
  static cleanText(text, isOcr = false) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const cleanFunction = isOcr ? this.cleanOcrText : this.cleanLine;
    
    // 先按行清洗，再合并
    const lines = text.split('\n');
    const cleanedLines = lines
      .map(line => cleanFunction(line))
      .filter(line => line && line.length > 0);
    
    // 合并行，去除多余的连续换行
    let result = cleanedLines.join('\n');
    
    // 去除连续的空行（最多保留两个换行）
    result = result.replace(/\n{3,}/g, '\n\n');
    
    return result.trim();
  }

  /**
   * 清洗 Markdown 文本（保留格式标记）
   * @param {string} text - Markdown 文本
   * @returns {string} - 清洗后的文本
   */
  static cleanMarkdown(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      // 1. 去除首尾空白
      .trim()
      // 2. 去除多余空格（但保留代码块中的空格）
      .replace(/(?<!```)\s+/g, ' ')
      // 3. 去除特殊控制字符
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      // 4. 去除零宽字符
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // 5. 标准化换行符
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 6. 去除过多的连续换行（最多保留两个）
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * 清洗 Excel 文本
   * @param {string} text - Excel 提取的文本
   * @returns {string} - 清洗后的文本
   */
  static cleanExcelText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      // 1. 去除首尾空白
      .trim()
      // 2. 去除多余空格
      .replace(/\s+/g, ' ')
      // 3. 去除特殊控制字符
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      // 4. 去除制表符（Excel 中可能使用制表符分隔）
      .replace(/\t+/g, '\t')
      // 5. 去除零宽字符
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
  }
}

module.exports = TextCleaner;

