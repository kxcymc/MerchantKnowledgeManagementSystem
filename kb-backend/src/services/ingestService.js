const path = require('path');
const { v4: uuid } = require('uuid');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const DashScopeEmbeddings = require('../utils/dashscopeEmbeddings');
const JsonVectorStore = require('../vectorStore');
const { extractTextFromFile, extractTextFromFileWithPageInfo } = require('./textExtractor');
const logger = require('../utils/logger');
const config = require('../config');

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,
  chunkOverlap: 160,
  separators: ['\n\n', '\n', '。', '！', '？', ' ']
});

// 三种存储模式：'json' | 'persistent' | 'server'
// 默认使用 'server' 模式（需要 Chroma 服务器）
const storeMode = config.vectorStore.mode || 'server';

let vectorStore;

if (storeMode === 'json') {
  // JSON 文件存储模式
  vectorStore = new JsonVectorStore(config.vectorStorePath);
  logger.info('使用 JSON 文件存储');
} else if (storeMode === 'persistent' || storeMode === 'server') {
  // Chroma 存储模式（persistent 本地文件 或 server 服务器模式）
  try {
    const ChromaVectorStore = require('../vectorStoreChroma');
    const chromaMode = storeMode === 'server' ? 'server' : 'persistent';
    
    vectorStore = new ChromaVectorStore({
      mode: chromaMode,
      host: config.chroma.host,
      port: config.chroma.port,
      path: config.chroma.path,
      collectionName: config.chroma.collectionName
    });
    logger.info(`使用 Chroma 向量存储（模式: ${chromaMode}）`);
  } catch (error) {
    logger.warn(`Chroma ${storeMode} 模式初始化失败，回退到 JSON 存储`, { error: error.message });
    vectorStore = new JsonVectorStore(config.vectorStorePath);
    logger.info('使用 JSON 文件存储（回退模式）');
  }
} else {
  // 未知模式，回退到 JSON
  logger.warn(`未知的存储模式: ${storeMode}，使用 JSON 存储`);
  vectorStore = new JsonVectorStore(config.vectorStorePath);
  logger.info('使用 JSON 文件存储');
}

let embeddingsInstance = null;

const getEmbeddings = () => {
  if (embeddingsInstance) return embeddingsInstance;
  if (!config.dashScopeKey) {
    throw new Error('DASHSCOPE_API_KEY 未配置，无法生成向量。');
  }
  embeddingsInstance = new DashScopeEmbeddings({
    dashScopeApiKey: config.dashScopeKey,
    model: 'text-embedding-v3'
  });
  return embeddingsInstance;
};

async function chunkAndEmbed(text, baseMetadata) {
  const documents = await splitter.createDocuments([text], [baseMetadata]);
  const embeddingsModel = getEmbeddings();
  const embeddings = await embeddingsModel.embedDocuments(documents.map((doc) => doc.pageContent));
  return documents.map((doc, index) => ({
    id: uuid(),
    text: doc.pageContent,
    metadata: doc.metadata,
    embedding: embeddings[index]
  }));
}

// 带页码和行号信息的chunk和embed处理
async function chunkAndEmbedWithPageInfo(pageLineData, baseMetadata) {
  // pageLineData是一个数组，每个元素包含{page, line, text}
  // 我们需要将这些数据合并为文本，同时记录每个chunk的页码和行号范围
  
  // 如果pageLineData为空，使用空的文本内容
  if (!pageLineData || pageLineData.length === 0) {
    logger.warn('pageLineData 为空，使用空文本');
    pageLineData = [{ page: 1, line: 1, text: '' }];
  }
  
  // 将所有文本合并
  let fullText = pageLineData.map(item => item.text || '').join('\n');
  const trimmedText = fullText.trim();
  
  // 如果合并后的文本为空或只包含空白字符，使用占位符
  if (!trimmedText || trimmedText.length === 0) {
    logger.warn('合并后的文本为空，使用占位符', { 
      filename: baseMetadata.filename,
      pageLineDataCount: pageLineData.length 
    });
    // 使用文件名作为占位文本
    const placeholderText = baseMetadata.filename 
      ? `[文件: ${baseMetadata.filename}]` 
      : '[空文档]';
    // 更新pageLineData，确保至少有内容
    if (pageLineData.length > 0) {
      pageLineData[0].text = placeholderText;
    } else {
      pageLineData.push({ page: 1, line: 1, text: placeholderText });
    }
    // 更新fullText
    fullText = placeholderText;
  }
  
  // 建立字符位置到页码行号的映射
  let charPos = 0;
  const positionMap = []; // [{charPos, page, line, textLength}]
  
  for (const item of pageLineData) {
    const itemText = item.text || '';
    const lineWithNewline = itemText + '\n';
    positionMap.push({
      startPos: charPos,
      endPos: charPos + lineWithNewline.length,
      page: item.page || 1,
      line: item.line || 1,
      text: itemText
    });
    charPos += lineWithNewline.length;
  }
  
  // 如果positionMap为空，至少添加一个默认项
  if (positionMap.length === 0) {
    positionMap.push({
      startPos: 0,
      endPos: fullText.length,
      page: 1,
      line: 1,
      text: fullText
    });
  }
  
  // 创建文档并分块（使用更新后的fullText）
  const documents = await splitter.createDocuments([fullText], [baseMetadata]);
  
  // 如果文档为空，创建一个包含文件信息的文档
  if (!documents || documents.length === 0) {
    logger.warn('splitter创建文档为空，创建占位文档', { 
      filename: baseMetadata.filename,
      textLength: fullText.length 
    });
    const placeholderText = `[文件: ${baseMetadata.filename || '未知文件'}]`;
    const placeholderDoc = await splitter.createDocuments([placeholderText], [baseMetadata]);
    if (placeholderDoc && placeholderDoc.length > 0) {
      documents.push(...placeholderDoc);
    } else {
      // 如果仍然为空，手动创建一个文档
      documents.push({
        pageContent: placeholderText,
        metadata: baseMetadata
      });
    }
  }
  const embeddingsModel = getEmbeddings();
  const embeddings = await embeddingsModel.embedDocuments(documents.map((doc) => doc.pageContent));
  
  // 为每个chunk找到对应的页码和行号
  let searchPos = 0;
  const chunks = [];
  
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const chunkText = doc.pageContent;
    
    // 在完整文本中找到chunk的位置
    const chunkStart = fullText.indexOf(chunkText, searchPos);
    if (chunkStart === -1) {
      // 如果找不到精确匹配，使用搜索位置作为近似
      searchPos = Math.min(searchPos, fullText.length);
    } else {
      searchPos = chunkStart;
    }
    const chunkEnd = searchPos + chunkText.length;
    
    // 找到chunk覆盖的起始和结束行
    let startPage = 1;
    let startLine = 1;
    let endPage = 1;
    let endLine = 1;
    
    for (const posInfo of positionMap) {
      // 检查chunk开始位置是否在这个行内
      if (searchPos >= posInfo.startPos && searchPos < posInfo.endPos) {
        startPage = posInfo.page;
        startLine = posInfo.line;
      }
      
      // 检查chunk结束位置是否在这个行内或之后
      if (chunkEnd > posInfo.startPos && chunkEnd <= posInfo.endPos) {
        endPage = posInfo.page;
        endLine = posInfo.line;
        break;
      }
      
      // 如果chunk跨越了这行
      if (searchPos < posInfo.endPos && chunkEnd > posInfo.startPos) {
        endPage = posInfo.page;
        endLine = posInfo.line;
      }
    }
    
    chunks.push({
      id: uuid(),
      text: chunkText,
      metadata: {
        ...doc.metadata,
        ...baseMetadata,
        page: startPage, // chunk开始的页码
        line: startLine, // chunk开始的行号
        endPage: endPage, // chunk结束的页码
        endLine: endLine  // chunk结束的行号
      },
      embedding: embeddings[i]
    });
    
    // 更新搜索位置
    searchPos = chunkEnd;
  }
  
  return chunks;
}

// 预估 chunk 数量（不进行 embedding，仅用于返回预估值）
async function estimateChunkCount({ filePath, originalName }) {
  try {
    const text = await extractTextFromFile(filePath, originalName);
    const documents = await splitter.createDocuments([text], [{}]);
    return documents.length;
  } catch (error) {
    logger.warn('预估 chunk 数量失败', { error: error.message, filename: originalName });
    return 0; // 如果预估失败，返回 0
  }
}

async function ingestRawText({ text, title = '自定义文本', tags = [], createdBy = 'anonymous', customMetadata = {} }) {
  const metadata = {
    sourceType: 'text',
    title,
    tags,
    createdBy,
    ...customMetadata // 允许传入自定义metadata（如knowledgeId）
  };
  const chunks = await chunkAndEmbed(text, metadata);
  await vectorStore.addMany(chunks);
  return chunks.length;
}

async function ingestFile({ filePath, originalName, mimeType, uploadedBy = 'anonymous', customMetadata = {} }) {
  try {
    // 使用新的带页码和行号信息的提取方法
    const pageLineData = await extractTextFromFileWithPageInfo(filePath, originalName);
    
    // 检查提取的文本是否为空
    const totalTextLength = pageLineData.reduce((sum, item) => sum + (item.text || '').length, 0);
    if (totalTextLength === 0) {
      logger.warn('文件文本提取为空，可能需要进行OCR', { 
        filename: originalName,
        filePath 
      });
      // 即使文本为空，也尝试创建至少一个chunk（包含文件元数据）
      pageLineData.push({ page: 1, line: 1, text: `[文件: ${originalName}]` });
    }
    
    const relativePath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
    const metadata = {
      sourceType: 'file',
      filename: originalName,
      mimeType,
      uploadedBy,
      storagePath: relativePath,
      ...customMetadata // 允许传入自定义metadata（如knowledgeId）
    };
    
    logger.info('开始向量化文件', { 
      filename: originalName,
      totalLines: pageLineData.length,
      totalTextLength 
    });
    
    const chunks = await chunkAndEmbedWithPageInfo(pageLineData, metadata);
    
    if (chunks.length === 0) {
      logger.warn('文件向量化后chunks为空', { filename: originalName });
      // 即使chunks为空，也创建一个包含文件信息的chunk
      const emptyChunk = {
        id: uuid(),
        text: `[文件: ${originalName}]`,
        metadata: {
          ...metadata,
          page: 1,
          line: 1
        },
        embedding: await getEmbeddings().embedQuery(`文件: ${originalName}`)
      };
      chunks.push(emptyChunk);
    }
    
    await vectorStore.addMany(chunks);
    logger.info('文件入库成功', { 
      filename: originalName, 
      chunks: chunks.length,
      textLength: totalTextLength
    });
    return chunks.length;
  } catch (error) {
    logger.error('文件入库失败', { 
      filename: originalName, 
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

module.exports = {
  ingestFile,
  ingestRawText,
  estimateChunkCount,
  vectorStore,
  splitter, // 导出 splitter 供外部使用
  chunkAndEmbedWithPageInfo // 导出带页码行号的chunk方法
};

