const { v4: uuid } = require('uuid');
const logger = require('../../shared/utils/logger');

// 尝试多种方式导入 chromadb
let PersistentClient;
let ChromaClient;
try {
  const chromadb = require('chromadb');
  
  // 尝试不同的导出方式
  if (chromadb.PersistentClient) {
    PersistentClient = chromadb.PersistentClient;
  } else if (chromadb.default?.PersistentClient) {
    PersistentClient = chromadb.default.PersistentClient;
  } else if (typeof chromadb === 'function') {
    PersistentClient = chromadb;
  }
  
  ChromaClient = chromadb.ChromaClient || chromadb.default?.ChromaClient;
  
  if (!PersistentClient && !ChromaClient) {
    logger.warn('无法找到 Chroma 客户端类，请检查 chromadb 版本');
  }
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error('\n❌ 错误：找不到 chromadb 模块！');
    console.error('\n📦 请先安装依赖：');
    console.error('   1. 打开命令提示符（CMD）');
    console.error('   2. 进入项目目录：cd /d f:\\字节训练营\\kb-backend');
    console.error('   3. 运行安装命令：npm install chromadb --legacy-peer-deps');
    console.error('\n💡 或者运行：npm install --legacy-peer-deps\n');
    throw new Error('请先安装 chromadb 模块。运行: npm install chromadb --legacy-peer-deps');
  }
  throw error;
}

class ChromaVectorStore {
  constructor(options = {}) {
    const {
      path = './data/chroma_db',
      collectionName = 'kb_documents',
      host = 'localhost',
      port = 8000,
      mode = 'server' // 'server' 或 'persistent'
    } = options;

    this.path = path;
    this.collectionName = collectionName;
    this.host = host;
    this.port = port;
    this.mode = mode;
    this.client = null;
    this.collection = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return this;

    try {
      // 明确使用 this.mode，如果未设置则根据 host/port 判断
      const actualMode = this.mode || (this.host && this.port ? 'server' : 'persistent');
      
      if (actualMode === 'server') {
        // 服务器模式：连接到运行中的 Chroma 服务器
        if (!ChromaClient) {
          throw new Error('ChromaClient 不可用，无法使用服务器模式。请确保 chromadb 已正确安装。');
        }
        
        if (!this.host || !this.port) {
          throw new Error('服务器模式需要配置 CHROMA_HOST 和 CHROMA_PORT');
        }
        
        this.client = new ChromaClient({
          host: this.host,
          port: this.port
        });
        logger.info(`连接到 Chroma 服务器 ${this.host}:${this.port}`);
      } else {
        // 本地文件模式（persistent）
        // 注意：chromadb Node.js 客户端不支持纯本地文件模式，必须通过服务器访问
        // 因此 persistent 模式也需要连接到服务器，但数据存储在本地目录
        // 默认使用 localhost:8001（persistent 模式的专用端口）
        if (!ChromaClient) {
          throw new Error('ChromaClient 不可用，无法使用本地文件模式。请确保 chromadb 已正确安装。');
        }
        
        // 确保目录存在
        const fs = require('fs-extra');
        await fs.ensureDir(this.path);
        
        // persistent 模式使用本地服务器，但数据存储在指定路径
        // 如果未指定 host/port，使用默认的 persistent 模式端口 8001
        const persistentHost = this.host || 'localhost';
        const persistentPort = this.port || 8001;
        
        this.client = new ChromaClient({
          host: persistentHost,
          port: persistentPort
        });
        logger.info(`使用 ChromaClient 本地文件存储模式（通过服务器 ${persistentHost}:${persistentPort}）`, { 
          path: this.path,
          note: '数据将存储在本地目录，但需要通过 Chroma 服务器访问。请确保已启动 persistent 模式的服务器。'
        });
      }

      // 获取或创建集合
      try {
        // 尝试使用 getOrCreateCollection（推荐方法）
        if (typeof this.client.getOrCreateCollection === 'function') {
          this.collection = await this.client.getOrCreateCollection({
            name: this.collectionName,
            metadata: { description: 'Knowledge base documents' }
          });
          logger.info('已获取或创建 Chroma 集合', { collection: this.collectionName });
        } else {
          // 如果没有 getOrCreateCollection，尝试分别获取和创建
          try {
            this.collection = await this.client.getCollection({
              name: this.collectionName
            });
            logger.info('已连接到现有 Chroma 集合', { collection: this.collectionName });
          } catch (getError) {
            // 集合不存在，创建新集合
            this.collection = await this.client.createCollection({
              name: this.collectionName,
              metadata: { description: 'Knowledge base documents' }
            });
            logger.info('已创建新的 Chroma 集合', { collection: this.collectionName });
          }
        }
      } catch (collectionError) {
        logger.error('集合操作失败', { error: collectionError.message });
        throw collectionError;
      }

      this.initialized = true;
      return this;
    } catch (error) {
      logger.error('Chroma 初始化失败', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async addMany(chunks) {
    if (!this.initialized) await this.init();

    if (!chunks || chunks.length === 0) return [];

    const ids = [];
    const embeddings = [];
    const documents = [];
    const metadatas = [];

    for (const chunk of chunks) {
      const id = chunk.id || uuid();
      ids.push(id);

      // 确保 embedding 是数组
      if (!Array.isArray(chunk.embedding)) {
        throw new Error('Embedding 必须是数组');
      }
      embeddings.push(chunk.embedding);

      documents.push(chunk.text || '');

      // 准备元数据，Chroma 只接受字符串、数字、布尔值
      const metadata = this.sanitizeMetadata(chunk.metadata || {});
      metadata.createdAt = chunk.createdAt || new Date().toISOString();
      metadatas.push(metadata);
    }

    try {
      await this.collection.add({
        ids,
        embeddings,
        documents,
        metadatas
      });

      logger.info('已添加文档到 Chroma', { count: ids.length });
      return ids;
    } catch (error) {
      logger.error('添加文档到 Chroma 失败', { error: error.message });
      throw error;
    }
  }

  async list(limit = 50) {
    if (!this.initialized) await this.init();

    try {
      const result = await this.collection.peek({ limit });
      
      return this.formatChromaResults(result);
    } catch (error) {
      logger.error('从 Chroma 查询列表失败', { error: error.message });
      return [];
    }
  }

  async listAll() {
    if (!this.initialized) await this.init();

    try {
      // Chroma 没有直接获取全部的方法，使用一个很大的 limit
      const count = await this.count();
      const result = await this.collection.peek({ limit: count || 10000 });
      
      return this.formatChromaResults(result);
    } catch (error) {
      logger.error('从 Chroma 查询全部失败', { error: error.message });
      return [];
    }
  }

  async count() {
    if (!this.initialized) await this.init();

    try {
      const count = await this.collection.count();
      return count;
    } catch (error) {
      logger.error('获取 Chroma 记录数失败', { error: error.message });
      return 0;
    }
  }

  async similaritySearch(queryEmbedding, topK = 5, filterFn) {
    if (!this.initialized) await this.init();

    if (!Array.isArray(queryEmbedding)) {
      throw new Error('查询向量必须是数组');
    }

    try {
      // 构建 Chroma where 过滤器（如果需要）
      const where = this.buildWhereClause(filterFn);

      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        where: Object.keys(where).length > 0 ? where : undefined
      });

      // 格式化为统一格式
      const formatted = [];
      if (results.ids && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          formatted.push({
            id: results.ids[0][i],
            text: results.documents[0][i] || '',
            metadata: results.metadatas[0][i] || {},
            embedding: results.embeddings ? results.embeddings[0][i] : null,
            score: results.distances ? 1 - results.distances[0][i] : null // 转换为相似度
          });
        }
      }

      // 如果有 filterFn，再过滤一次（Chroma 的 where 查询有限）
      if (typeof filterFn === 'function') {
        return formatted.filter((item) => filterFn(item));
      }

      return formatted;
    } catch (error) {
      logger.error('Chroma 相似度搜索失败', { error: error.message });
      throw error;
    }
  }

  async removeWhere(filterFn) {
    if (!this.initialized) await this.init();

    if (typeof filterFn !== 'function') {
      throw new Error('filterFn 必须是函数');
    }

    try {
      // 先获取所有记录
      const allRecords = await this.listAll();
      
      // 找出需要删除的 IDs
      const idsToDelete = allRecords
        .filter((record) => filterFn(record))
        .map((record) => record.id);

      if (idsToDelete.length === 0) {
        return 0;
      }

      // 删除这些记录
      await this.collection.delete({
        ids: idsToDelete
      });

      logger.info('已从 Chroma 删除文档', { count: idsToDelete.length });
      return idsToDelete.length;
    } catch (error) {
      logger.error('从 Chroma 删除文档失败', { error: error.message });
      throw error;
    }
  }

  async updateWhere(filterFn, updater) {
    if (!this.initialized) await this.init();

    if (typeof filterFn !== 'function' || typeof updater !== 'function') {
      throw new Error('filterFn 和 updater 都必须是函数');
    }

    try {
      // 获取所有记录
      const allRecords = await this.listAll();
      
      let updated = 0;
      const updates = [];

      for (const record of allRecords) {
        if (filterFn(record)) {
          // 创建更新后的记录
          const updatedRecord = { ...record };
          const originalText = record.text;
          updater(updatedRecord);

          // 检查文档内容是否改变
          const textChanged = (updatedRecord.text || '') !== (originalText || '');

          // Chroma 使用 update 方法更新
          // 如果只更新元数据，不传递 documents，避免触发嵌入向量重新生成
          updates.push({
            id: record.id,
            metadata: this.sanitizeMetadata(updatedRecord.metadata || {}),
            document: textChanged ? (updatedRecord.text || record.text) : null
          });

          updated++;
        }
      }

      // 批量更新（只更新元数据时，不传递 documents，避免触发嵌入向量重新生成）
      for (const update of updates) {
        const updatePayload = {
          ids: [update.id],
          metadatas: [update.metadata]
        };
        
        // 只有文档内容改变时才传递 documents
        if (update.document) {
          updatePayload.documents = [update.document];
        }
        
        await this.collection.update(updatePayload);
      }

      if (updated > 0) {
        logger.info('已更新 Chroma 文档', { count: updated });
      }

      return updated;
    } catch (error) {
      logger.error('更新 Chroma 文档失败', { error: error.message });
      throw error;
    }
  }

  // 辅助方法：清理元数据（Chroma 只接受字符串、数字、布尔值）
  sanitizeMetadata(metadata) {
    const sanitized = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (value === null || value === undefined) {
        continue;
      }
      const type = typeof value;
      if (type === 'string' || type === 'number' || type === 'boolean') {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        // 数组转为 JSON 字符串
        sanitized[key] = JSON.stringify(value);
      } else if (type === 'object') {
        // 对象转为 JSON 字符串
        sanitized[key] = JSON.stringify(value);
      }
    }
    return sanitized;
  }

  // 辅助方法：构建 Chroma where 子句（有限支持）
  buildWhereClause(filterFn) {
    // Chroma 的 where 查询有限，这里返回空对象
    // 实际的过滤在 similaritySearch 中通过 filterFn 完成
    return {};
  }

  // 辅助方法：格式化 Chroma 查询结果
  formatChromaResults(result) {
    if (!result || !result.ids || !result.ids.length) {
      return [];
    }

    const formatted = [];
    for (let i = 0; i < result.ids.length; i++) {
      const metadata = result.metadatas ? (result.metadatas[i] || {}) : {};
      
      // 尝试解析 JSON 字符串的元数据
      const parsedMetadata = {};
      for (const [key, value] of Object.entries(metadata)) {
        if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
          try {
            parsedMetadata[key] = JSON.parse(value);
          } catch {
            parsedMetadata[key] = value;
          }
        } else {
          parsedMetadata[key] = value;
        }
      }

      formatted.push({
        id: result.ids[i],
        text: result.documents ? (result.documents[i] || '') : '',
        metadata: parsedMetadata,
        embedding: result.embeddings ? result.embeddings[i] : null,
        createdAt: parsedMetadata.createdAt || null
      });
    }

    return formatted;
  }
}

module.exports = ChromaVectorStore;

