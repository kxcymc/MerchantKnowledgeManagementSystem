const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const logger = require('../../../shared/utils/logger');

/**
 * 智能语义分割器
 * 功能：
 * 1. 先使用RecursiveCharacterTextSplitter进行初步分割
 * 2. 检查每个chunk的大小
 * 3. 如果chunk太小（< minChunkSize），尝试与相邻chunk合并（保持语义完整性）
 * 4. 如果chunk太大（> maxChunkSize），进行更细粒度的语义分割
 * 5. 在整个过程中保持位置信息（page, line）
 */
class SemanticSplitter {
  constructor(options = {}) {
    this.minChunkSize = options.minChunkSize || 200; // 最小chunk大小（字符数）
    this.maxChunkSize = options.maxChunkSize || 1500; // 最大chunk大小（字符数）
    this.targetChunkSize = options.targetChunkSize || 800; // 目标chunk大小
    this.chunkOverlap = options.chunkOverlap || 160; // chunk重叠大小
    
    // 用于初步分割的splitter
    this.baseSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.targetChunkSize,
      chunkOverlap: this.chunkOverlap,
      separators: ['\n\n', '\n', '。', '！', '？', '；', '，', ' ']
    });
    
    // 用于拆分过大chunk的splitter（更细粒度）
    this.fineSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: Math.floor(this.targetChunkSize * 0.6), // 更小的chunk size用于拆分
      chunkOverlap: Math.floor(this.chunkOverlap * 0.5),
      separators: ['\n', '。', '！', '？', '；', '，', ' ']
    });
  }

  /**
   * 智能分割文本，返回chunk数组，每个chunk包含文本和位置信息
   * @param {string} text - 要分割的文本
   * @param {Array} positionMap - 位置映射数组 [{startPos, endPos, page, line, text}]
   * @returns {Array} chunk数组，每个chunk包含 {text, startPos, endPos, page, line, endPage, endLine, size}
   */
  async splitTextWithPosition(text, positionMap = []) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // 第一步：使用基础splitter进行初步分割
    const baseChunks = await this.baseSplitter.createDocuments([text]);
    
    logger.debug('初步分割完成', {
      totalChunks: baseChunks.length,
      avgChunkSize: baseChunks.length > 0 
        ? Math.round(baseChunks.reduce((sum, c) => sum + c.pageContent.length, 0) / baseChunks.length)
        : 0
    });

    // 第二步：为每个chunk找到位置信息
    let searchPos = 0;
    const chunksWithPosition = [];

    for (const chunk of baseChunks) {
      const chunkText = chunk.pageContent;
      
      // 在完整文本中找到chunk的位置
      let chunkStart = text.indexOf(chunkText, searchPos);
      
      // 如果找不到精确匹配，尝试去除空白字符后匹配
      if (chunkStart === -1) {
        const normalizedChunkText = chunkText.replace(/\s+/g, ' ').trim();
        const normalizedText = text.replace(/\s+/g, ' ');
        chunkStart = normalizedText.indexOf(normalizedChunkText, searchPos);
        
        if (chunkStart === -1) {
          // 如果仍然找不到，使用搜索位置作为近似
          const chunkRatio = chunksWithPosition.length / baseChunks.length;
          chunkStart = Math.floor(text.length * chunkRatio);
        }
      }
      
      searchPos = chunkStart;
      const chunkEnd = searchPos + chunkText.length;
      
      // 找到chunk对应的位置信息
      const position = this.findPositionForChunk(chunkStart, chunkEnd, positionMap);
      
      chunksWithPosition.push({
        text: chunkText,
        startPos: chunkStart,
        endPos: chunkEnd,
        page: position.startPage,
        line: position.startLine,
        endPage: position.endPage,
        endLine: position.endLine,
        size: chunkText.length
      });
    }

    // 第三步：处理过小的chunk（合并）
    const mergedChunks = this.mergeSmallChunks(chunksWithPosition);
    
    logger.debug('合并小chunk完成', {
      before: chunksWithPosition.length,
      after: mergedChunks.length
    });

    // 第四步：处理过大的chunk（拆分）
    const finalChunks = this.splitLargeChunks(mergedChunks, text, positionMap);
    
    logger.info('智能语义分割完成', {
      before: baseChunks.length,
      after: finalChunks.length,
      avgChunkSize: finalChunks.length > 0
        ? Math.round(finalChunks.reduce((sum, c) => sum + c.size, 0) / finalChunks.length)
        : 0,
      minChunkSize: finalChunks.length > 0 ? Math.min(...finalChunks.map(c => c.size)) : 0,
      maxChunkSize: finalChunks.length > 0 ? Math.max(...finalChunks.map(c => c.size)) : 0
    });

    return finalChunks;
  }

  /**
   * 为chunk找到对应的位置信息
   */
  findPositionForChunk(chunkStart, chunkEnd, positionMap) {
    let startPage = 1;
    let startLine = 1;
    let endPage = 1;
    let endLine = 1;
    let startFound = false;

    for (const posInfo of positionMap) {
      // 检查chunk开始位置是否在这个行内
      if (!startFound && chunkStart >= posInfo.startPos && chunkStart < posInfo.endPos) {
        startPage = posInfo.page;
        startLine = posInfo.line;
        startFound = true;
        endPage = posInfo.page;
        endLine = posInfo.line;
      }

      // 如果已经找到起始位置，检查chunk是否覆盖了这一行
      if (startFound) {
        const chunkOverlapsLine = (chunkStart >= posInfo.startPos && chunkStart < posInfo.endPos) ||
                                   (chunkEnd > posInfo.startPos && chunkEnd <= posInfo.endPos) ||
                                   (chunkStart < posInfo.endPos && chunkEnd > posInfo.startPos);

        if (chunkOverlapsLine) {
          endPage = posInfo.page;
          endLine = posInfo.line;
        }
      }
    }

    // 如果没有找到起始位置，使用第一个位置
    if (!startFound && positionMap.length > 0) {
      startPage = positionMap[0].page;
      startLine = positionMap[0].line;
      endPage = positionMap[0].page;
      endLine = positionMap[0].line;
    }

    // 如果chunk结束位置超过了所有行，使用最后一行
    if (positionMap.length > 0) {
      const lastPos = positionMap[positionMap.length - 1];
      if (chunkEnd > lastPos.endPos) {
        endPage = lastPos.page;
        endLine = lastPos.line;
      }
    }

    return { startPage, startLine, endPage, endLine };
  }

  /**
   * 合并过小的chunk
   * 策略：如果chunk太小，尝试与下一个chunk合并，直到达到合适的大小或超过最大大小
   */
  mergeSmallChunks(chunks) {
    if (chunks.length === 0) return [];

    const merged = [];
    let currentChunk = { ...chunks[0] };

    for (let i = 1; i < chunks.length; i++) {
      const nextChunk = chunks[i];
      
      // 如果当前chunk太小，尝试与下一个chunk合并
      if (currentChunk.size < this.minChunkSize) {
        const mergedSize = currentChunk.size + nextChunk.size;
        
        // 如果合并后不超过最大大小，则合并
        if (mergedSize <= this.maxChunkSize) {
          currentChunk = {
            text: currentChunk.text + '\n' + nextChunk.text,
            startPos: currentChunk.startPos,
            endPos: nextChunk.endPos,
            page: currentChunk.page,
            line: currentChunk.line,
            endPage: nextChunk.endPage,
            endLine: nextChunk.endLine,
            size: mergedSize
          };
          continue;
        }
      }
      
      // 如果当前chunk已经足够大，或者合并后会超过最大大小，保存当前chunk
      merged.push(currentChunk);
      currentChunk = { ...nextChunk };
    }

    // 添加最后一个chunk
    merged.push(currentChunk);

    return merged;
  }

  /**
   * 拆分过大的chunk
   * 策略：使用更细粒度的splitter进行拆分，并保持位置信息
   */
  splitLargeChunks(chunks, fullText, positionMap) {
    const finalChunks = [];

    for (const chunk of chunks) {
      if (chunk.size <= this.maxChunkSize) {
        // chunk大小合适，直接添加
        finalChunks.push(chunk);
      } else {
        // chunk太大，需要拆分
        logger.debug('拆分大chunk', {
          originalSize: chunk.size,
          startPos: chunk.startPos,
          endPos: chunk.endPos,
          page: chunk.page,
          endPage: chunk.endPage
        });

        // 使用更细粒度的splitter拆分
        const subChunks = this.fineSplitter.splitText(chunk.text);
        
        let subStartPos = chunk.startPos;
        
        for (const subText of subChunks) {
          const subEndPos = subStartPos + subText.length;
          
          // 为子chunk找到位置信息
          const position = this.findPositionForChunk(subStartPos, subEndPos, positionMap);
          
          finalChunks.push({
            text: subText,
            startPos: subStartPos,
            endPos: subEndPos,
            page: position.startPage,
            line: position.startLine,
            endPage: position.endPage,
            endLine: position.endLine,
            size: subText.length
          });
          
          subStartPos = subEndPos;
        }
      }
    }

    return finalChunks;
  }
}

module.exports = SemanticSplitter;

