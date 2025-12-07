const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('../../../shared/utils/logger');

// 创建 MySQL 连接池（QA Chatbot 业务数据库）
const pool = mysql.createPool({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  charset: 'utf8mb4',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0
});

// 创建知识库数据库连接池（用于检索 Knowledge 表）
const kbasePool = mysql.createPool({
  host: config.kbaseDb.host,
  port: config.kbaseDb.port,
  user: config.kbaseDb.user,
  password: config.kbaseDb.password,
  database: config.kbaseDb.database,
  charset: 'utf8mb4',
  connectionLimit: 5,
  waitForConnections: true,
  queueLimit: 0
});

// 测试数据库连接
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    logger.info('QA Chatbot 数据库连接成功');
    
    const kbaseConnection = await kbasePool.getConnection();
    await kbaseConnection.ping();
    kbaseConnection.release();
    logger.info('知识库数据库连接成功');
    return true;
  } catch (error) {
    logger.error('数据库连接失败', { error: error.message });
    return false;
  }
}

// ============================================
// ID 生成器
// ============================================
async function getNextId(idType) {
  const sql = `
    UPDATE IDGenerator 
    SET current_id = current_id + 1 
    WHERE id_type = ?
  `;
  await pool.execute(sql, [idType]);
  
  const [rows] = await pool.execute(
    'SELECT current_id FROM IDGenerator WHERE id_type = ?',
    [idType]
  );
  return rows[0].current_id;
}

async function getNextSessionId() {
  return await getNextId('session_id');
}

async function getNextMessageId() {
  return await getNextId('message_id');
}

// ============================================
// Session 相关操作
// ============================================
async function createSession(sessionId, title = null) {
  const sql = `INSERT INTO Session (session_id, title) VALUES (?, ?)`;
  await pool.execute(sql, [sessionId, title]);
  logger.info('创建会话', { sessionId, title });
  return sessionId;
}

async function getSessionById(sessionId) {
  const [rows] = await pool.execute(
    'SELECT * FROM Session WHERE session_id = ? AND visible = 1',
    [sessionId]
  );
  return rows[0] || null;
}

async function getAllSessions() {
  const [rows] = await pool.execute(
    `SELECT * FROM Session WHERE visible = 1 ORDER BY created_at DESC`
  );
  return rows;
}

async function softDeleteSession(sessionId) {
  const sql = `UPDATE Session SET visible = 0 WHERE session_id = ?`;
  const [result] = await pool.execute(sql, [sessionId]);
  return result.affectedRows > 0;
}

async function updateSession(sessionId, updates) {
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = Object.values(updates);
  values.push(sessionId);
  
  const sql = `UPDATE Session SET ${fields} WHERE session_id = ?`;
  await pool.execute(sql, values);
}

// ============================================
// Message 相关操作
// ============================================
async function createMessage(messageData) {
  const {
    message_id,
    session_id,
    role,
    content,
    sequence_num,
    token_count = 0,
    question_hash = null,
    cluster_id = null
  } = messageData;

  const sql = `
    INSERT INTO Message 
    (message_id, session_id, role, content, sequence_num, token_count, question_hash, cluster_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  await pool.execute(sql, [
    message_id,
    session_id,
    role,
    content,
    sequence_num,
    token_count,
    question_hash,
    cluster_id
  ]);

  // 更新会话消息计数
  await pool.execute(
    `UPDATE Session SET 
     message_count = message_count + 1,
     last_message_at = NOW(),
     updated_at = NOW()
     WHERE session_id = ?`,
    [session_id]
  );

  logger.info('创建消息', { message_id, session_id, role });
  return message_id;
}

async function getMessagesBySessionId(sessionId) {
  const [rows] = await pool.execute(
    `SELECT * FROM Message WHERE session_id = ? ORDER BY sequence_num ASC`,
    [sessionId]
  );
  return rows;
}

// ============================================
// MessageCitation 相关操作
// ============================================
async function createMessageCitation(citationData) {
  const {
    message_id,
    vector_id,
    knowledge_id,
    chunk_text,
    chunk_metadata,
    score,
    rank_order = 1
  } = citationData;

  const sql = `
    INSERT INTO MessageCitation
    (message_id, vector_id, knowledge_id, chunk_text, chunk_metadata, score, rank_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  await pool.execute(sql, [
    message_id,
    vector_id,
    knowledge_id,
    chunk_text,
    JSON.stringify(chunk_metadata || {}),
    score,
    rank_order
  ]);
}

async function getCitationsByMessageId(messageId) {
  const [rows] = await pool.execute(
    `SELECT * FROM MessageCitation WHERE message_id = ? ORDER BY rank_order ASC`,
    [messageId]
  );
  
  return rows.map(row => {
    // 处理 chunk_metadata：可能是 JSON 字符串或已经是对象
    let chunkMetadata = {};
    if (row.chunk_metadata) {
      if (typeof row.chunk_metadata === 'string') {
        try {
          chunkMetadata = JSON.parse(row.chunk_metadata);
        } catch (e) {
          // 如果解析失败，使用空对象
          chunkMetadata = {};
        }
      } else if (typeof row.chunk_metadata === 'object') {
        // 如果已经是对象，直接使用
        chunkMetadata = row.chunk_metadata;
      }
    }
    
    return {
      ...row,
      chunk_metadata: chunkMetadata
    };
  });
}

/**
 * 批量获取多个消息的引用
 * @param {number[]} messageIds - 消息ID数组
 * @returns {Map<number, Array>} - message_id -> citations 的映射
 */
async function getCitationsByMessageIds(messageIds) {
  if (messageIds.length === 0) return new Map();
  
  const placeholders = messageIds.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT * FROM MessageCitation 
     WHERE message_id IN (${placeholders}) 
     ORDER BY message_id, rank_order ASC`,
    messageIds
  );
  
  // 按 message_id 分组
  const citationsMap = new Map();
  for (const row of rows) {
    if (!citationsMap.has(row.message_id)) {
      citationsMap.set(row.message_id, []);
    }
    
    // 处理 chunk_metadata：可能是 JSON 字符串或已经是对象
    let chunkMetadata = {};
    if (row.chunk_metadata) {
      if (typeof row.chunk_metadata === 'string') {
        try {
          chunkMetadata = JSON.parse(row.chunk_metadata);
        } catch (e) {
          // 如果解析失败，使用空对象
          chunkMetadata = {};
        }
      } else if (typeof row.chunk_metadata === 'object') {
        // 如果已经是对象，直接使用
        chunkMetadata = row.chunk_metadata;
      }
    }
    
    citationsMap.get(row.message_id).push({
      ...row,
      chunk_metadata: chunkMetadata
    });
  }
  
  return citationsMap;
}

// ============================================
// Knowledge 表查询（从知识库数据库）
// ============================================
async function getKnowledgeById(knowledgeId) {
  const [rows] = await kbasePool.execute(
    `SELECT 
      k.knowledge_id,
      k.type,
      k.file_url,
      k.title,
      k.status,
      k.content,
      k.created_at,
      k.updated_at,
      bs.business,
      bs.scene
    FROM Knowledge k
    LEFT JOIN BusinessScene bs ON k.business_id = bs.business_id
    WHERE k.knowledge_id = ?`,
    [knowledgeId]
  );
  return rows[0] || null;
}

/**
 * 批量获取知识库信息
 * @param {number[]} knowledgeIds - 知识库ID数组
 * @returns {Map<number, Object>} - knowledge_id -> knowledge 的映射
 */
async function getKnowledgeByIds(knowledgeIds) {
  if (knowledgeIds.length === 0) return new Map();
  
  const placeholders = knowledgeIds.map(() => '?').join(',');
  const [rows] = await kbasePool.execute(
    `SELECT 
      k.knowledge_id,
      k.type,
      k.file_url,
      k.title,
      k.status,
      k.content,
      bs.business,
      bs.scene
    FROM Knowledge k
    LEFT JOIN BusinessScene bs ON k.business_id = bs.business_id
    WHERE k.knowledge_id IN (${placeholders})`,
    knowledgeIds
  );
  
  // 转换为 Map
  const knowledgeMap = new Map();
  for (const row of rows) {
    knowledgeMap.set(row.knowledge_id, row);
  }
  
  return knowledgeMap;
}

// ============================================
// 统计相关操作
// ============================================
async function getCitationHeatmap(options = {}) {
  const { startDate = null, endDate = null, limit = 100 } = options;
  
  let sql = `
    SELECT 
      mc.knowledge_id,
      COUNT(mc.citation_id) as citation_count,
      COUNT(DISTINCT mc.message_id) as message_count,
      COUNT(DISTINCT m.session_id) as session_count,
      MAX(mc.created_at) as last_cited_at,
      AVG(mc.score) as avg_score
    FROM MessageCitation mc
    INNER JOIN Message m ON mc.message_id = m.message_id
    WHERE 1=1
  `;
  
  const params = [];
  if (startDate) {
    sql += ` AND mc.created_at >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    sql += ` AND mc.created_at <= ?`;
    params.push(endDate);
  }
  
  sql += `
    GROUP BY mc.knowledge_id
    HAVING citation_count > 0
    ORDER BY citation_count DESC
    LIMIT ?
  `;
  params.push(limit);
  
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function getTopNQuestions(options = {}) {
  const { topN = 10, startDate = null, endDate = null, minCount = 2 } = options;
  
  let sql = `
    SELECT 
      qc.cluster_id,
      qc.representative_question,
      qc.question_count,
      qc.session_count,
      qc.first_asked_at,
      qc.last_asked_at
    FROM QuestionCluster qc
    WHERE 1=1
  `;
  
  const params = [];
  if (startDate) {
    sql += ` AND qc.first_asked_at >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    sql += ` AND qc.last_asked_at <= ?`;
    params.push(endDate);
  }
  
  sql += `
    AND qc.question_count >= ?
    ORDER BY qc.question_count DESC, qc.session_count DESC
    LIMIT ?
  `;
  params.push(minCount, topN);
  
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function saveZeroHitQuestion(questionData) {
  const {
    message_id,
    session_id,
    question_text,
    question_hash
  } = questionData;

  // 检查是否已存在
  const [existing] = await pool.execute(
    `SELECT question_id, asked_count FROM ZeroHitQuestion WHERE question_hash = ?`,
    [question_hash]
  );

  if (existing.length > 0) {
    // 更新计数
    await pool.execute(
      `UPDATE ZeroHitQuestion 
       SET asked_count = asked_count + 1,
           last_asked_at = NOW()
       WHERE question_hash = ?`,
      [question_hash]
    );
    return existing[0].question_id;
  } else {
    // 插入新记录
    const [result] = await pool.execute(
      `INSERT INTO ZeroHitQuestion 
       (message_id, session_id, question_text, question_hash)
       VALUES (?, ?, ?, ?)`,
      [message_id, session_id, question_text, question_hash]
    );
    return result.insertId;
  }
}

// ============================================
// 问题聚类相关数据库操作
// ============================================

/**
 * 获取所有聚类及其代表问题（用于相似度计算）
 */
async function getAllClustersWithEmbeddings() {
  const [rows] = await pool.execute(
    `SELECT 
      cluster_id,
      representative_question,
      question_count,
      session_count,
      first_asked_at,
      last_asked_at
     FROM QuestionCluster
     ORDER BY cluster_id`
  );
  
  // 注意：这里不包含嵌入向量，因为表中没有存储
  // 聚类服务会根据代表问题动态计算嵌入向量
  return rows.map(row => ({
    cluster_id: row.cluster_id,
    representative_question: row.representative_question,
    question_count: row.question_count,
    session_count: row.session_count,
    first_asked_at: row.first_asked_at,
    last_asked_at: row.last_asked_at,
    representative_embedding: null // 需要动态计算
  }));
}

/**
 * 创建新问题聚类
 */
async function createQuestionCluster(clusterData) {
  const {
    representative_question,
    representative_embedding = null,
    first_asked_at = null,
    last_asked_at = null
  } = clusterData;

  const [result] = await pool.execute(
    `INSERT INTO QuestionCluster 
     (representative_question, question_count, session_count, first_asked_at, last_asked_at)
     VALUES (?, 0, 0, ?, ?)`,
    [
      representative_question,
      first_asked_at || new Date(),
      last_asked_at || new Date()
    ]
  );

  return result.insertId;
}

/**
 * 添加问题到聚类成员表
 */
async function addQuestionToCluster(memberData) {
  const {
    cluster_id,
    message_id,
    question_text,
    similarity_score = null
  } = memberData;

  // 使用 INSERT IGNORE 避免重复添加
  await pool.execute(
    `INSERT IGNORE INTO QuestionClusterMember 
     (cluster_id, message_id, question_text, similarity_score)
     VALUES (?, ?, ?, ?)`,
    [cluster_id, message_id, question_text, similarity_score]
  );
}

/**
 * 更新聚类统计信息
 */
async function updateClusterStats(clusterId, sessionId) {
  // 更新问题数量
  await pool.execute(
    `UPDATE QuestionCluster 
     SET question_count = (
       SELECT COUNT(*) 
       FROM QuestionClusterMember 
       WHERE cluster_id = ?
     ),
     last_asked_at = NOW()
     WHERE cluster_id = ?`,
    [clusterId, clusterId]
  );

  // 更新会话数量（统计该聚类中涉及的唯一会话数）
  await pool.execute(
    `UPDATE QuestionCluster 
     SET session_count = (
       SELECT COUNT(DISTINCT m.session_id)
       FROM QuestionClusterMember qcm
       INNER JOIN Message m ON qcm.message_id = m.message_id
       WHERE qcm.cluster_id = ?
     )
     WHERE cluster_id = ?`,
    [clusterId, clusterId]
  );

  // 如果这是首次提问，更新首次提问时间
  const [cluster] = await pool.execute(
    `SELECT first_asked_at FROM QuestionCluster WHERE cluster_id = ?`,
    [clusterId]
  );
  
  if (cluster.length > 0 && !cluster[0].first_asked_at) {
    await pool.execute(
      `UPDATE QuestionCluster 
       SET first_asked_at = NOW()
       WHERE cluster_id = ?`,
      [clusterId]
    );
  }
}

/**
 * 更新消息的 cluster_id
 */
async function updateMessageClusterId(messageId, clusterId) {
  await pool.execute(
    `UPDATE Message 
     SET cluster_id = ?
     WHERE message_id = ?`,
    [clusterId, messageId]
  );
}

/**
 * 更新聚类的嵌入向量（如果表中有该字段）
 * 注意：当前表结构中没有此字段，此方法预留用于未来优化
 */
async function updateClusterEmbedding(clusterId, embedding) {
  // 当前表结构中没有存储嵌入向量的字段
  // 如果需要优化性能，可以添加 representative_embedding JSON 字段
  // 目前此方法为空实现
  return;
}

module.exports = {
  pool,
  kbasePool,
  testConnection,
  getNextSessionId,
  getNextMessageId,
  createSession,
  getSessionById,
  getAllSessions,
  softDeleteSession,
  updateSession,
  createMessage,
  getMessagesBySessionId,
  createMessageCitation,
  getCitationsByMessageId,
  getCitationsByMessageIds,
  getKnowledgeById,
  getKnowledgeByIds,
  getCitationHeatmap,
  getTopNQuestions,
  saveZeroHitQuestion,
  // 聚类相关方法
  getAllClustersWithEmbeddings,
  createQuestionCluster,
  addQuestionToCluster,
  updateClusterStats,
  updateMessageClusterId,
  updateClusterEmbedding
};

