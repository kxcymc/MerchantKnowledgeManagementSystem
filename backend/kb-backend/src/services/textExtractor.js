const path = require('path');
const fs = require('fs-extra');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const matter = require('gray-matter');
const xlsx = require('xlsx');
const { runOcrOnPdf, getPdfPageCount } = require('./ocrService');
const TextCleaner = require('./textCleaner');

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.markdown', '.xlsx', '.xls'];

async function readTextFile(filePath, encoding = 'utf-8') {
  return fs.readFile(filePath, encoding);
}

// 提取PDF文本（支持按页提取）
async function extractPdf(filePath) {
  const buffer = await fs.readFile(filePath);
  const parsed = await pdfParse(buffer);
  let text = parsed.text?.trim() ?? '';
  
  // 如果文本长度足够，直接返回（清洗后）
  if (text.length >= 50) {
    return TextCleaner.cleanText(text, false);
  }
  
  // 文本太短，可能是扫描版 PDF，尝试 OCR
  try {
    const ocrText = await runOcrOnPdf(filePath);
    
    if (ocrText && ocrText.length > text.length) {
      // OCR 文本需要更严格的清洗
      return TextCleaner.cleanText(ocrText, true);
    } else if (ocrText && ocrText.length > 0) {
      return TextCleaner.cleanText(ocrText, true);
    }
    
    return TextCleaner.cleanText(text, false);
  } catch (error) {
    // OCR 失败时返回原始文本（清洗后）
    return TextCleaner.cleanText(text, false);
  }
}

// 提取PDF文本，返回带页码和行号信息的结构化数据
async function extractPdfWithPageInfo(filePath) {
  const logger = require('../../../shared/utils/logger');
  
  const buffer = await fs.readFile(filePath);
  const parsed = await pdfParse(buffer);
  let fullText = parsed.text?.trim() ?? '';
  const totalPages = parsed.numpages || 1;
  
  logger.info('PDF文本提取', { 
    filePath: path.basename(filePath),
    textLength: fullText.length,
    totalPages 
  });
  
  // 如果文本长度足够，使用pdf-parse的结果，按页分割
  if (fullText.length >= 50) {
    // pdf-parse可能不直接支持按页提取，我们尝试从metadata中获取
    // 如果无法获取分页信息，则估算（假设每页文本长度相近）
    const pages = [];
    const avgCharsPerPage = Math.max(1, Math.floor(fullText.length / totalPages));
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const start = (pageNum - 1) * avgCharsPerPage;
      const end = pageNum === totalPages ? fullText.length : pageNum * avgCharsPerPage;
      const pageText = fullText.slice(start, end);
      
      if (pageText.trim()) {
        const lines = pageText.split('\n');
        lines.forEach((line, lineIndex) => {
          // 清洗文本但保留位置信息
          const cleanedLine = TextCleaner.cleanLine(line);
          if (cleanedLine && cleanedLine.length > 0) {
            pages.push({
              page: pageNum,
              line: lineIndex + 1,
              text: cleanedLine
            });
          }
        });
      }
    }
    
    // 如果过滤后为空，说明虽然是PDF但可能是扫描版，尝试OCR
    if (pages.length > 0) {
      logger.info('PDF文本提取成功', { 
        filePath: path.basename(filePath),
        pagesCount: pages.length,
        totalPages 
      });
      return pages;
    }
    
    // 即使文本长度>=50，但过滤后为空，可能是扫描版，尝试OCR
    logger.info('PDF文本提取后为空，尝试OCR', { 
      filePath: path.basename(filePath),
      originalTextLength: fullText.length,
      totalPages 
    });
  }
  
  // 文本太短或提取后为空，可能是扫描版PDF，使用OCR逐页提取
  logger.info('PDF文本长度不足，尝试OCR提取', { 
    filePath: path.basename(filePath),
    textLength: fullText.length,
    totalPages 
  });
  
  try {
    const pageCount = await getPdfPageCount(filePath);
    const pages = [];
    
    // 调用OCR进行文本提取（按页返回结果）
    logger.info('开始OCR处理', { filePath: path.basename(filePath), pageCount });
    const ocrPageResults = await runOcrOnPdf(filePath, null, true); // 处理所有页面，按页返回
    
    logger.info('OCR处理完成', { 
      filePath: path.basename(filePath),
      expectedPages: pageCount,
      actualPages: ocrPageResults.length,
      processedPages: ocrPageResults.filter(p => p.text && p.text.length > 0).length,
      emptyPages: ocrPageResults.filter(p => !p.text || p.text.length === 0).length
    });
    
    // 检查是否所有页面都被处理
    if (ocrPageResults.length < pageCount) {
      logger.warn('OCR处理页面数不足', {
        filePath: path.basename(filePath),
        expected: pageCount,
        actual: ocrPageResults.length,
        missingPages: Array.from({ length: pageCount }, (_, i) => i + 1)
          .filter(pageNum => !ocrPageResults.some(r => r.page === pageNum))
      });
    }
    
    // 按页处理OCR结果，每页的文本按行分割
    for (const pageResult of ocrPageResults) {
      const pageNum = pageResult.page;
      const pageText = pageResult.text || '';
      
      if (pageText && pageText.length > 0) {
        // 按行分割页面文本
        const lines = pageText.split('\n');
        
        lines.forEach((line, lineIndex) => {
          if (line && line.trim()) {
            // OCR 文本需要更严格的清洗，但保留位置信息
            const cleanedLine = TextCleaner.cleanOcrText(line);
            if (cleanedLine && cleanedLine.length > 0) {
              pages.push({
                page: pageNum,
                line: lineIndex + 1, // 每页的行号从1开始
                text: cleanedLine
              });
            }
          }
        });
      } else {
        // 即使页面没有文本，也记录一个空行，确保页面信息不丢失
        logger.debug('OCR页面无文本', { 
          filePath: path.basename(filePath), 
          page: pageNum 
        });
      }
    }
    
    logger.info('OCR文本处理完成', { 
      filePath: path.basename(filePath),
      totalLines: pages.length, // 总行数
      totalPages: ocrPageResults.length, // OCR处理的页数
      expectedPages: pageCount, // PDF总页数
      pagesWithText: new Set(pages.map(p => p.page)).size // 有文本的页数
    });
    
    // 如果OCR没有提取到文本，使用原始文本
    if (pages.length === 0 && fullText) {
      const fallbackResult = fullText.split('\n')
        .map((line, idx) => {
          const cleanedLine = TextCleaner.cleanLine(line);
          return { page: 1, line: idx + 1, text: cleanedLine };
        })
        .filter(p => p.text && p.text.length > 0);
      
      if (fallbackResult.length > 0) {
        logger.info('使用原始PDF文本', { 
          filePath: path.basename(filePath),
          linesCount: fallbackResult.length 
        });
        return fallbackResult;
      }
    }
    
    // 如果仍然为空，至少返回一个空行
    if (pages.length === 0) {
      logger.warn('OCR和PDF解析都未提取到文本', { filePath: path.basename(filePath) });
      return [{ page: 1, line: 1, text: '' }];
    }
    
    return pages;
  } catch (error) {
    logger.error('OCR处理失败', { 
      filePath: path.basename(filePath),
      error: error.message 
    });
    
    // OCR失败，尝试使用原始文本
    if (fullText) {
      const fallbackPages = fullText.split('\n')
        .map((line, idx) => {
          const cleanedLine = TextCleaner.cleanLine(line);
          return { page: 1, line: idx + 1, text: cleanedLine };
        })
        .filter(p => p.text && p.text.length > 0);
      
      if (fallbackPages.length > 0) {
        return fallbackPages;
      }
    }
    
    // 如果仍然为空，至少返回一个空行
    return [{ page: 1, line: 1, text: '' }];
  }
}

async function extractDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  // 清洗 Word 文本
  return TextCleaner.cleanText(result.value, false);
}

// 提取DOCX文本，返回带行号信息的结构化数据（DOCX没有明确的页码概念，使用行号）
async function extractDocxWithPageInfo(filePath) {
  const docxResult = await mammoth.extractRawText({ path: filePath });
  const fullText = docxResult.value || '';
  const lines = fullText.split('\n');
  
  const result = lines.map((line, index) => {
    // 清洗文本但保留位置信息
    const cleanedLine = TextCleaner.cleanLine(line);
    return {
      page: 1, // DOCX没有明确的页码，统一设为1
      line: index + 1,
      text: cleanedLine
    };
  }).filter(p => p.text && p.text.length > 0);
  
  // 如果过滤后为空，至少返回一个空行
  return result.length > 0 ? result : [{ page: 1, line: 1, text: '' }];
}

async function extractMarkdown(filePath) {
  const raw = await readTextFile(filePath);
  const { content } = matter(raw);
  // Markdown 文本清洗（保留格式标记）
  return TextCleaner.cleanMarkdown(content);
}

// 提取Markdown文本，返回带行号信息的结构化数据
async function extractMarkdownWithPageInfo(filePath) {
  const raw = await readTextFile(filePath);
  const { content } = matter(raw);
  const lines = content.split('\n');
  
  const result = lines.map((line, index) => {
    // Markdown 文本清洗（保留格式标记），但保留位置信息
    const cleanedLine = TextCleaner.cleanMarkdown(line);
    return {
      page: 1, // Markdown没有明确的页码，统一设为1
      line: index + 1,
      text: cleanedLine
    };
  }).filter(p => p.text && p.text.length > 0);
  
  // 如果过滤后为空，至少返回一个空行
  return result.length > 0 ? result : [{ page: 1, line: 1, text: '' }];
}

// 提取 Excel 文本，返回带行号信息的结构化数据
async function extractExcelWithPageInfo(filePath) {
  const workbook = xlsx.readFile(filePath);
  const pages = [];

  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true });

    rows.forEach((row, rowIndex) => {
      if (!Array.isArray(row)) return;
      const lineText = row
        .map((cell) => (cell === undefined || cell === null ? '' : String(cell)))
        .join('\t');
      
      // Excel 文本清洗，但保留位置信息
      const cleanedText = TextCleaner.cleanExcelText(`${sheetName}: ${lineText}`);

      if (cleanedText && cleanedText.length > 0) {
        pages.push({
          page: sheetIndex + 1,
          line: rowIndex + 1,
          text: cleanedText
        });
      }
    });
  });

  return pages.length > 0 ? pages : [{ page: 1, line: 1, text: '' }];
}

// 提取文本文件，返回带行号信息的结构化数据
async function extractTextFileWithPageInfo(filePath) {
  const fullText = await readTextFile(filePath);
  const lines = fullText.split('\n');
  
  const result = lines.map((line, index) => {
    // 清洗文本但保留位置信息
    const cleanedLine = TextCleaner.cleanLine(line);
    return {
      page: 1, // 文本文件没有明确的页码，统一设为1
      line: index + 1,
      text: cleanedLine
    };
  }).filter(p => p.text && p.text.length > 0);
  
  // 如果过滤后为空，至少返回一个空行
  return result.length > 0 ? result : [{ page: 1, line: 1, text: '' }];
}

async function extractTextFromFile(filePath, originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(`不支持的文件类型: ${ext}`);
  }

  if (ext === '.pdf') return extractPdf(filePath);
  if (ext === '.docx') return extractDocx(filePath);
  if (ext === '.md' || ext === '.markdown') return extractMarkdown(filePath);

  // Excel 转为纯文本（按行拼接）
  if (ext === '.xlsx' || ext === '.xls') {
    const pages = await extractExcelWithPageInfo(filePath);
    return pages.map((p) => p.text).join('\n');
  }

  // 文本文件清洗
  const text = await readTextFile(filePath);
  return TextCleaner.cleanText(text, false);
}

// 提取文本，返回带页码和行号信息的结构化数据
async function extractTextFromFileWithPageInfo(filePath, originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(`不支持的文件类型: ${ext}`);
  }

  if (ext === '.pdf') return extractPdfWithPageInfo(filePath);
  if (ext === '.docx') return extractDocxWithPageInfo(filePath);
  if (ext === '.md' || ext === '.markdown') return extractMarkdownWithPageInfo(filePath);
  if (ext === '.xlsx' || ext === '.xls') return extractExcelWithPageInfo(filePath);
  
  return extractTextFileWithPageInfo(filePath);
}

module.exports = {
  extractTextFromFile,
  extractTextFromFileWithPageInfo
};

