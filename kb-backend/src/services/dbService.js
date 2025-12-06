const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('../utils/logger');

// 创建 MySQL 连接池
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

// 测试数据库连接
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    logger.info('MySQL 数据库连接成功');
    return true;
  } catch (error) {
    logger.error('MySQL 数据库连接失败', { error: error.message });
    return false;
  }
}

// 查询知识库记录（多条件查询）
async function queryKnowledge(params = {}) {
  const {
    title,
    business,
    scene,
    status,
    start_date,
    end_date
  } = params;

  let sql = `
    SELECT 
      k.knowledge_id,
      k.type,
      k.file_size,
      k.file_url,
      k.title,
      k.content,
      k.status,
      k.refer_num,
      k.created_at,
      k.updated_at,
      bs.business,
      bs.scene
    FROM Knowledge k
    LEFT JOIN BusinessScene bs ON k.business_id = bs.business_id
    WHERE 1=1
  `;
  
  const values = [];

  if (title) {
    sql += ` AND k.title LIKE ?`;
    values.push(`%${title}%`);
  }

  if (business) {
    sql += ` AND bs.business = ?`;
    values.push(business);
  }

  if (scene) {
    sql += ` AND bs.scene = ?`;
    values.push(scene);
  }

  if (status) {
    sql += ` AND k.status = ?`;
    values.push(status);
  }

  if (start_date) {
    sql += ` AND k.created_at >= ?`;
    values.push(start_date);
  }

  if (end_date) {
    sql += ` AND k.created_at <= ?`;
    values.push(end_date);
  }

  sql += ` ORDER BY k.created_at DESC`;

  try {
    const [rows] = await pool.execute(sql, values);
    return rows;
  } catch (error) {
    logger.error('查询知识库失败', { error: error.message, params });
    throw error;
  }
}

// 根据business和scene获取business_id
async function getBusinessId(business, scene) {
  if (!business) {
    throw new Error('business 不能为空');
  }

  // 构造查询条件
  // 如果 scene 存在，则查询 business + scene
  // 如果 scene 不存在（null/undefined/空字符串），则查询 business + (scene IS NULL OR scene = '')
  // 注意：数据库中 scene 字段可能为 NULL
  
  let sql;
  let params;

  if (scene) {
    sql = `SELECT business_id FROM BusinessScene WHERE business = ? AND scene = ? LIMIT 1`;
    params = [business, scene];
  } else {
    sql = `SELECT business_id FROM BusinessScene WHERE business = ? AND (scene IS NULL OR scene = '') LIMIT 1`;
    params = [business];
  }

  const [rows] = await pool.execute(sql, params);

  if (rows.length > 0) {
    return rows[0].business_id;
  }

  throw new Error(`未找到对应的业务场景: ${business} - ${scene || '无'}`);
}

// 插入知识库记录
async function insertKnowledge(data) {
  const {
    type,
    file_size = 0,
    file_url = '',
    title,
    content = null,
    business,
    scene
  } = data;

  if (!title) {
    throw new Error('title 不能为空');
  }

  if (!type) {
    throw new Error('type 不能为空');
  }

  // 获取 business_id
  const businessId = await getBusinessId(business, scene);

  // 将content转为JSON字符串（如果是对象）
  let contentJson = content;
  if (content && typeof content === 'object') {
    contentJson = JSON.stringify(content);
  }

  const sql = `
    INSERT INTO Knowledge (business_id, type, file_url, file_size, title, content, status)
    VALUES (?, ?, ?, ?, ?, ?, '生效中')
  `;

  try {
    const [result] = await pool.execute(sql, [
      businessId,
      type,
      file_url,
      file_size,
      title,
      contentJson
    ]);

    logger.info('插入知识库记录成功', { knowledge_id: result.insertId, title });
    return result.insertId;
  } catch (error) {
    logger.error('插入知识库记录失败', { error: error.message, data });
    throw error;
  }
}

// 批量插入知识库记录
async function insertKnowledgeBatch(dataList) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const knowledgeIds = [];
    
    for (const data of dataList) {
      const knowledgeId = await insertKnowledge(data);
      knowledgeIds.push(knowledgeId);
    }
    
    await connection.commit();
    
    logger.info('批量插入知识库记录成功', { count: knowledgeIds.length });
    return knowledgeIds;
  } catch (error) {
    await connection.rollback();
    logger.error('批量插入知识库记录失败', { error: error.message });
    throw error;
  } finally {
    connection.release();
  }
}

// 根据knowledge_id查询记录
async function getKnowledgeById(knowledgeId) {
  const sql = `
    SELECT 
      k.knowledge_id,
      k.business_id,
      k.type,
      k.file_size,
      k.file_url,
      k.title,
      k.content,
      k.status,
      k.refer_num,
      k.created_at,
      k.updated_at,
      bs.business,
      bs.scene
    FROM Knowledge k
    LEFT JOIN BusinessScene bs ON k.business_id = bs.business_id
    WHERE k.knowledge_id = ?
  `;

  try {
    const [rows] = await pool.execute(sql, [knowledgeId]);
    if (rows.length === 0) {
      return null;
    }
    
    const record = rows[0];
    // 如果content是JSON字符串，尝试解析
    if (record.content && typeof record.content === 'string') {
      try {
        record.content = JSON.parse(record.content);
      } catch {
        // 解析失败则保持原样
      }
    }
    
    return record;
  } catch (error) {
    logger.error('查询知识库记录失败', { error: error.message, knowledgeId });
    throw error;
  }
}

// 更新知识库记录
async function updateKnowledge(knowledgeId, updates) {
  const {
    title,
    content,
    status,
    business,
    scene,
    file_url,
    file_size
  } = updates;

  // 构建更新字段
  const setFields = [];
  const values = [];

  if (title !== undefined) {
    setFields.push('title = ?');
    values.push(title);
  }

  if (content !== undefined) {
    let contentJson = content;
    if (content && typeof content === 'object') {
      contentJson = JSON.stringify(content);
    }
    setFields.push('content = ?');
    values.push(contentJson);
  }

  if (status !== undefined) {
    setFields.push('status = ?');
    values.push(status);
  }

  if (file_url !== undefined) {
    setFields.push('file_url = ?');
    values.push(file_url);
  }

  if (file_size !== undefined) {
    setFields.push('file_size = ?');
    values.push(file_size);
  }

  // 如果business或scene改变，需要更新scene_id
  if (business || scene) {
    const current = await getKnowledgeById(knowledgeId);
    if (!current) {
      throw new Error(`knowledge_id ${knowledgeId} 不存在`);
    }

    const newBusiness = business || current.business;
    const newScene = scene || current.scene;
    
    if (newBusiness) {
      // 即使 scene 没变，也需要重新查询 business_id，因为 business 变了
      // 或者 scene 变了，也需要重新查询
      // 这里简化逻辑：只要 business 或 scene 有值（在 updates 中），就重新计算 business_id
      // 但需要注意 updates 中可能只传了其中一个，另一个需要从 current 中取
      
      const businessId = await getBusinessId(newBusiness, newScene);
      setFields.push('business_id = ?');
      values.push(businessId);
    }
  }

  // 自动更新 updated_at 字段
  setFields.push('updated_at = NOW()');

  if (setFields.length === 0) {
    throw new Error('至少需要提供一个更新字段');
  }

  values.push(knowledgeId);

  const sql = `UPDATE Knowledge SET ${setFields.join(', ')} WHERE knowledge_id = ?`;

  try {
    const [result] = await pool.execute(sql, values);
    logger.info('更新知识库记录成功', { knowledgeId, updatedFields: setFields.length });
    return result.affectedRows > 0;
  } catch (error) {
    logger.error('更新知识库记录失败', { error: error.message, knowledgeId, updates });
    throw error;
  }
}

// 删除知识库记录
async function deleteKnowledge(knowledgeId) {
  const sql = `DELETE FROM Knowledge WHERE knowledge_id = ?`;

  try {
    const [result] = await pool.execute(sql, [knowledgeId]);
    logger.info('删除知识库记录成功', { knowledgeId });
    return result.affectedRows > 0;
  } catch (error) {
    logger.error('删除知识库记录失败', { error: error.message, knowledgeId });
    throw error;
  }
}



// 增加引用次数
async function incrementReferNum(knowledgeId) {
  const sql = `UPDATE Knowledge SET refer_num = refer_num + 1 WHERE knowledge_id = ?`;

  try {
    await pool.execute(sql, [knowledgeId]);
  } catch (error) {
    logger.error('增加引用次数失败', { error: error.message, knowledgeId });
  }
}

// 根据title查询知识记录（用于检查同名文件）
async function getKnowledgeByTitle(title) {
  const sql = `
    SELECT 
      k.knowledge_id,
      k.business_id,
      k.type,
      k.file_size,
      k.file_url,
      k.title,
      k.content,
      k.status,
      k.refer_num,
      k.created_at,
      k.updated_at,
      bs.business,
      bs.scene
    FROM Knowledge k
    LEFT JOIN BusinessScene bs ON k.business_id = bs.business_id
    WHERE k.title = ?
    ORDER BY k.created_at DESC
    LIMIT 1
  `;

  try {
    const [rows] = await pool.execute(sql, [title]);
    if (rows.length === 0) {
      return null;
    }
    
    const record = rows[0];
    // 如果content是JSON字符串，尝试解析
    if (record.content && typeof record.content === 'string') {
      try {
        record.content = JSON.parse(record.content);
      } catch {
        // 解析失败则保持原样
      }
    }
    
    return record;
  } catch (error) {
    logger.error('根据title查询知识库记录失败', { error: error.message, title });
    throw error;
  }
}

module.exports = {
  pool,
  testConnection,
  queryKnowledge,
  insertKnowledge,
  insertKnowledgeBatch,
  getKnowledgeById,
  getKnowledgeByTitle,
  updateKnowledge,
  deleteKnowledge,
  incrementReferNum,
  getBusinessId
};

