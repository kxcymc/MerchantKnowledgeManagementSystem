const { ChromaClient } = require('chromadb');
const logger = require('../../../shared/utils/logger');
const config = require('../config');

class VectorStore {
  constructor() {
    this.client = null;
    this.collection = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return this;

    try {
      this.client = new ChromaClient({
        host: config.chroma.host,
        port: config.chroma.port
      });

      // 只读取已存在的集合（只读模式，不创建、不修改、不删除）
      try {
        this.collection = await this.client.getCollection({
          name: config.chroma.collectionName
        });
        logger.info('已连接到 Chroma 向量数据库集合（只读模式）', { 
          collection: config.chroma.collectionName 
        });
      } catch (error) {
        // 集合不存在，抛出明确错误提示
        const errorMsg = `向量数据库集合 "${config.chroma.collectionName}" 不存在。` +
          `请先使用 kb-backend 构建知识库向量数据库，QA Chatbot 仅用于消费读取，不会创建新集合。`;
        logger.error('Chroma 集合不存在', { 
          collection: config.chroma.collectionName,
          error: error.message 
        });
        throw new Error(errorMsg);
      }

      this.initialized = true;
      return this;
    } catch (error) {
      logger.error('Chroma 初始化失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 向量相似度搜索（只读操作）
   * 仅从已构建的向量数据库中检索，不进行任何写入操作
   */
  async similaritySearch(queryEmbedding, topK = 5, filterFn = null) {
    if (!this.initialized) await this.init();

    if (!Array.isArray(queryEmbedding)) {
      throw new Error('查询向量必须是数组');
    }

    try {
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK
      });

      const formatted = [];
      if (results.ids && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const metadata = results.metadatas ? (results.metadatas[0][i] || {}) : {};
          const item = {
            id: results.ids[0][i],
            text: results.documents[0][i] || '',
            metadata: metadata,
            score: results.distances ? (1 - results.distances[0][i]) : null
          };
          
          // 应用过滤器
          if (!filterFn || filterFn(item)) {
            formatted.push(item);
          }
        }
      }

      // 按分数排序
      formatted.sort((a, b) => (b.score || 0) - (a.score || 0));

      return formatted;
    } catch (error) {
      logger.error('向量相似度搜索失败', { error: error.message });
      throw error;
    }
  }
}

module.exports = new VectorStore();

