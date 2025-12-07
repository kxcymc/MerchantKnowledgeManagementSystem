const { getEmbeddings } = require('../utils/getEmbeddings');
const dbService = require('./dbService');
const config = require('../config');
const logger = require('../../../shared/utils/logger');

class ClusterService {
  constructor() {
    this.embeddings = null;
  }

  /**
   * 获取嵌入模型实例
   */
  getEmbeddings() {
    if (!this.embeddings) {
      this.embeddings = getEmbeddings();
    }
    return this.embeddings;
  }

  /**
   * 计算两个向量的余弦相似度
   * @param {Array<number>} vecA - 向量A
   * @param {Array<number>} vecB - 向量B
   * @returns {number} 余弦相似度值 (0-1)
   */
  cosineSimilarity(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
      throw new Error('向量必须是数组');
    }
    if (vecA.length !== vecB.length) {
      throw new Error('向量维度必须相同');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * 查找最相似的聚类
   * @param {Array<number>} questionEmbedding - 问题的嵌入向量
   * @returns {Object|null} 最相似的聚类信息，如果没有找到则返回null
   */
  async findSimilarCluster(questionEmbedding) {
    try {
      // 获取所有聚类及其代表问题的嵌入向量
      const clusters = await dbService.getAllClustersWithEmbeddings();
      
      if (!clusters || clusters.length === 0) {
        return null;
      }

      let bestCluster = null;
      let bestSimilarity = 0;

      // 遍历所有聚类，计算相似度
      for (const cluster of clusters) {
        const representativeQuestion = cluster.representative_question;
        if (!representativeQuestion) continue;
        
        // 每次重新计算代表问题的嵌入向量
        // 注意：如果表中有存储字段，可以优化为直接读取
        const repEmbedding = await this.getEmbeddings().embedQuery(representativeQuestion);

        const similarity = this.cosineSimilarity(
          questionEmbedding,
          repEmbedding
        );

        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCluster = {
            cluster_id: cluster.cluster_id,
            representative_question: cluster.representative_question,
            similarity: similarity
          };
        }
      }

      // 如果相似度超过阈值，返回最佳聚类
      if (bestSimilarity >= config.clustering.similarityThreshold) {
        return bestCluster;
      }

      return null;
    } catch (error) {
      logger.error('查找相似聚类失败', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * 对问题进行聚类
   * @param {string} question - 问题文本
   * @param {number} messageId - 消息ID
   * @param {number} sessionId - 会话ID
   * @returns {Object} 聚类结果 { cluster_id, isNewCluster, similarity }
   */
  async clusterQuestion(question, messageId, sessionId) {
    if (!config.clustering.enabled) {
      logger.debug('问题聚类功能已禁用');
      return null;
    }

    try {
      // 1. 生成问题的嵌入向量
      logger.info('开始对问题进行聚类', { question: question.substring(0, 50), messageId });
      const questionEmbedding = await this.getEmbeddings().embedQuery(question);

      // 2. 查找相似的聚类
      const similarCluster = await this.findSimilarCluster(questionEmbedding);

      let clusterId;
      let isNewCluster = false;
      let similarity = null;

      if (similarCluster) {
        // 3. 找到相似聚类，加入现有聚类
        clusterId = similarCluster.cluster_id;
        similarity = similarCluster.similarity;
        isNewCluster = false;

        logger.info('找到相似聚类，加入现有聚类', {
          cluster_id: clusterId,
          similarity: similarity.toFixed(4),
          question: question.substring(0, 50)
        });
      } else {
        // 4. 没有找到相似聚类，创建新聚类
        clusterId = await dbService.createQuestionCluster({
          representative_question: question,
          representative_embedding: questionEmbedding,
          first_asked_at: new Date(),
          last_asked_at: new Date()
        });
        isNewCluster = true;

        logger.info('创建新聚类', {
          cluster_id: clusterId,
          question: question.substring(0, 50)
        });
      }

      // 5. 将问题添加到聚类成员表
      await dbService.addQuestionToCluster({
        cluster_id: clusterId,
        message_id: messageId,
        question_text: question,
        similarity_score: similarity
      });

      // 6. 更新聚类统计信息
      await dbService.updateClusterStats(clusterId, sessionId);

      // 7. 更新消息的 cluster_id
      await dbService.updateMessageClusterId(messageId, clusterId);

      return {
        cluster_id: clusterId,
        isNewCluster,
        similarity
      };
    } catch (error) {
      logger.error('问题聚类失败', {
        error: error.message,
        stack: error.stack,
        question: question.substring(0, 50),
        messageId
      });
      // 聚类失败不影响主流程，只记录错误
      return null;
    }
  }
}

module.exports = new ClusterService();

