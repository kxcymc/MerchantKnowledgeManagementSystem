/**
 * 数据库初始化脚本
 * 支持按项目选择性初始化表结构
 * 
 * 使用方法：
 * node scripts/init-database.js                    # 初始化所有表
 * node scripts/init-database.js --kb-only          # 只初始化 kb-backend 相关表
 * node scripts/init-database.js --qa-only          # 只初始化 qa-chatbot-backend 相关表
 */

// Set UTF-8 encoding for Windows console
if (process.platform === 'win32') {
  try {
    if (process.stdout.setDefaultEncoding) {
      process.stdout.setDefaultEncoding('utf8');
    }
    if (process.stderr.setDefaultEncoding) {
      process.stderr.setDefaultEncoding('utf8');
    }
    // Try to set console code page to UTF-8
    const { execSync } = require('child_process');
    execSync('chcp 65001 >nul 2>&1', { stdio: 'ignore' });
  } catch (e) {
    // Ignore errors
  }
}

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const logger = {
  info: (msg, meta) => console.log(`[INFO] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || ''),
  success: (msg, meta) => console.log(`[SUCCESS] ${msg}`, meta || '')
};

// 数据库配置
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'KBase',
  password: process.env.MYSQL_PASSWORD || '123456',
  database: process.env.MYSQL_DATABASE || 'kb_database',
  charset: 'utf8mb4'
};

/**
 * 检查表是否存在
 */
async function tableExists(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as count FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [dbConfig.database, tableName]
  );
  return rows[0].count > 0;
}

/**
 * 创建数据库（如果不存在）
 */
async function createDatabaseIfNotExists(connection) {
  try {
    // CREATE DATABASE 和 USE 语句不支持 prepared statement，需要使用 query 方法
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    logger.info(`数据库 ${dbConfig.database} 检查/创建完成`);
    
    // 切换到目标数据库
    await connection.query(`USE \`${dbConfig.database}\``);
    return true;
  } catch (error) {
    logger.error(`创建数据库失败`, { error: error.message });
    throw error;
  }
}

/**
 * kb-backend 表结构
 */
const kbBackendSchemas = {
  BusinessScene: `
    CREATE TABLE IF NOT EXISTS BusinessScene (
      business_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '业务id,主键',
      business VARCHAR(100) NOT NULL COMMENT '业务名称',
      scene_id INT NULL DEFAULT 0 COMMENT '场景ID',
      scene VARCHAR(100) NULL DEFAULT NULL COMMENT '场景名称',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      PRIMARY KEY (business_id),
      UNIQUE KEY uk_business_scene (business, scene_id),
      KEY idx_business_scene (business, scene)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='业务场景表'
  `,

  Knowledge: `
    CREATE TABLE IF NOT EXISTS Knowledge (
      knowledge_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '知识ID',
      business_id BIGINT NOT NULL COMMENT '业务ID',
      type VARCHAR(50) NOT NULL COMMENT '文件类型（pdf, word, txt, markdown, json等）',
      file_url VARCHAR(500) DEFAULT NULL COMMENT '文件访问路径',
      file_size BIGINT DEFAULT 0 COMMENT '文件大小（字节）',
      title VARCHAR(255) NOT NULL COMMENT '标题',
      content TEXT DEFAULT NULL COMMENT '内容',
      status VARCHAR(50) NOT NULL DEFAULT '生效中' COMMENT '状态（生效中、已失效等）',
      refer_num INT NOT NULL DEFAULT 0 COMMENT '引用次数',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      PRIMARY KEY (knowledge_id),
      KEY idx_business_id (business_id),
      KEY idx_type (type),
      KEY idx_status (status),
      KEY idx_title (title),
      KEY idx_created_at (created_at),
      CONSTRAINT fk_knowledge_business FOREIGN KEY (business_id) REFERENCES BusinessScene (business_id) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识库表'
  `
};

/**
 * qa-chatbot-backend 表结构
 */
const qaBackendSchemas = {
  Session: `
    CREATE TABLE IF NOT EXISTS Session (
      session_id INT PRIMARY KEY AUTO_INCREMENT COMMENT '会话唯一标识，全局唯一',
      title VARCHAR(255) DEFAULT NULL COMMENT '会话标题（首条提问自动生成）',
      visible TINYINT DEFAULT 1 COMMENT '是否可见：1=可见，0=已删除',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '会话创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '会话更新时间',
      message_count INT DEFAULT 0 COMMENT '消息总数',
      last_message_at TIMESTAMP DEFAULT NULL COMMENT '最后一条消息时间',
      INDEX idx_visible_updated (visible, updated_at DESC),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话表'
  `,

  Message: `
    CREATE TABLE IF NOT EXISTS Message (
      message_id INT PRIMARY KEY AUTO_INCREMENT COMMENT '消息唯一标识，全局唯一',
      session_id INT NOT NULL COMMENT '所属会话ID',
      role ENUM('user', 'AI') NOT NULL COMMENT '消息角色：user=用户，AI=AI回复',
      content TEXT NOT NULL COMMENT '消息内容',
      sequence_num INT NOT NULL COMMENT '会话内的消息序号（从1开始）',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '消息创建时间',
      token_count INT DEFAULT 0 COMMENT 'Token数量（估算）',
      question_hash VARCHAR(64) DEFAULT NULL COMMENT '问题文本的MD5哈希（仅用户消息）',
      cluster_id INT DEFAULT NULL COMMENT '所属问题聚类ID（仅用户消息）',
      INDEX idx_session_sequence (session_id, sequence_num),
      INDEX idx_session_role (session_id, role),
      INDEX idx_question_hash (question_hash),
      INDEX idx_cluster_id (cluster_id),
      INDEX idx_created_at (created_at),
      FOREIGN KEY (session_id) REFERENCES Session(session_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息表'
  `,

  MessageCitation: `
    CREATE TABLE IF NOT EXISTS MessageCitation (
      citation_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '引用记录唯一标识',
      message_id INT NOT NULL COMMENT 'AI消息ID',
      vector_id VARCHAR(255) NOT NULL COMMENT 'Chroma向量数据库中的向量ID',
      knowledge_id INT DEFAULT NULL COMMENT '知识库文件ID（关联Knowledge表）',
      chunk_text TEXT COMMENT '引用的文本片段',
      chunk_metadata JSON COMMENT '向量数据的元数据',
      score DECIMAL(5,4) DEFAULT NULL COMMENT '相似度分数（0-1）',
      rank_order INT DEFAULT 1 COMMENT '在同一消息中的排序',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '引用记录创建时间',
      INDEX idx_message_id (message_id),
      INDEX idx_vector_id (vector_id),
      INDEX idx_knowledge_id (knowledge_id),
      INDEX idx_created_at (created_at),
      FOREIGN KEY (message_id) REFERENCES Message(message_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息引用表'
  `,

  QuestionCluster: `
    CREATE TABLE IF NOT EXISTS QuestionCluster (
      cluster_id INT PRIMARY KEY AUTO_INCREMENT COMMENT '聚类唯一标识',
      representative_question TEXT NOT NULL COMMENT '代表问题（聚类中心）',
      question_count INT DEFAULT 0 COMMENT '该聚类中的问题总数',
      session_count INT DEFAULT 0 COMMENT '涉及的会话数量',
      first_asked_at TIMESTAMP DEFAULT NULL COMMENT '首次提问时间',
      last_asked_at TIMESTAMP DEFAULT NULL COMMENT '最近提问时间',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '聚类创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '聚类更新时间',
      INDEX idx_question_count (question_count DESC),
      INDEX idx_last_asked (last_asked_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='问题聚类表'
  `,

  QuestionClusterMember: `
    CREATE TABLE IF NOT EXISTS QuestionClusterMember (
      member_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '成员记录唯一标识',
      cluster_id INT NOT NULL COMMENT '所属聚类ID',
      message_id INT NOT NULL COMMENT '问题消息ID',
      question_text TEXT NOT NULL COMMENT '原始问题文本',
      similarity_score DECIMAL(5,4) DEFAULT NULL COMMENT '与代表问题的相似度',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '加入聚类时间',
      UNIQUE KEY uk_cluster_message (cluster_id, message_id),
      INDEX idx_cluster_id (cluster_id),
      INDEX idx_message_id (message_id),
      FOREIGN KEY (cluster_id) REFERENCES QuestionCluster(cluster_id) ON DELETE CASCADE,
      FOREIGN KEY (message_id) REFERENCES Message(message_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='问题聚类成员表'
  `,

  ZeroHitQuestion: `
    CREATE TABLE IF NOT EXISTS ZeroHitQuestion (
      question_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '问题记录唯一标识',
      message_id INT NOT NULL COMMENT '对应的消息ID',
      session_id INT NOT NULL COMMENT '所属会话ID',
      question_text TEXT NOT NULL COMMENT '问题文本',
      question_hash VARCHAR(64) NOT NULL COMMENT '问题哈希值',
      asked_count INT DEFAULT 1 COMMENT '被提问次数',
      first_asked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '首次提问时间',
      last_asked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最近提问时间',
      INDEX idx_question_hash (question_hash),
      INDEX idx_asked_count (asked_count DESC),
      INDEX idx_last_asked (last_asked_at DESC),
      FOREIGN KEY (message_id) REFERENCES Message(message_id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES Session(session_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='零命中问题表（知识库无法回答的问题）'
  `,

  IDGenerator: `
    CREATE TABLE IF NOT EXISTS IDGenerator (
      id_type VARCHAR(32) PRIMARY KEY COMMENT 'ID类型：session_id 或 message_id',
      current_id INT DEFAULT 0 COMMENT '当前最大ID值',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ID生成器表'
  `
};

/**
 * 初始化 BusinessScene 表的初始数据
 */
async function initBusinessSceneData(connection) {
  try {
    const initialData = [
      ['经营成长', 0, null],
      ['招商入驻', 0, null],
      ['招商入驻', 1, '保证金管理'],
      ['招商入驻', 2, '入驻与退出'],
      ['资金结算', 0, null]
    ];

    for (const [business, scene_id, scene] of initialData) {
      await connection.execute(
        `INSERT INTO BusinessScene (business, scene_id, scene) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE business = business`,
        [business, scene_id, scene]
      );
    }
    logger.info('BusinessScene 初始数据初始化完成');
  } catch (error) {
    logger.warn('BusinessScene 初始数据初始化失败（可能已存在）', { error: error.message });
  }
}

/**
 * 初始化 ID 生成器
 */
async function initIDGenerator(connection) {
  try {
    await connection.execute(
      `INSERT INTO IDGenerator (id_type, current_id) VALUES ('session_id', 0)
       ON DUPLICATE KEY UPDATE current_id = current_id`
    );
    await connection.execute(
      `INSERT INTO IDGenerator (id_type, current_id) VALUES ('message_id', 0)
       ON DUPLICATE KEY UPDATE current_id = current_id`
    );
    logger.info('ID 生成器初始化完成');
  } catch (error) {
    logger.warn('ID 生成器初始化失败（可能已存在）', { error: error.message });
  }
}

/**
 * 表分类
 */
const tableGroups = {
  kb: ['BusinessScene', 'Knowledge'],  // kb-backend 核心表
  qa: ['Session', 'Message', 'MessageCitation', 'QuestionCluster', 'QuestionClusterMember', 'ZeroHitQuestion', 'IDGenerator']  // qa-chatbot-backend 表
};

/**
 * 创建表的顺序（考虑外键依赖）
 */
const tableCreationOrder = [
  ...tableGroups.kb,
  ...tableGroups.qa
];

/**
 * 获取需要初始化的表列表
 */
function getTablesToInit() {
  const args = process.argv.slice(2);
  
  if (args.includes('--kb-only')) {
    return tableGroups.kb;
  } else if (args.includes('--qa-only')) {
    return tableGroups.qa;
  } else {
    // 默认初始化所有表
    return tableCreationOrder;
  }
}

/**
 * 主函数
 */
async function main() {
  let connection;
  
  try {
    logger.info('开始初始化数据库...');
    logger.info('数据库配置', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user
    });

    // 连接到 MySQL（不指定数据库）
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      charset: dbConfig.charset
    });

    logger.info('MySQL 连接成功');

    // 创建数据库（如果不存在）
    await createDatabaseIfNotExists(connection);

    // 合并所有表结构
    const allSchemas = { ...kbBackendSchemas, ...qaBackendSchemas };

    // 获取需要初始化的表列表
    const tablesToInit = getTablesToInit();
    const initMode = process.argv.includes('--kb-only') ? 'kb-backend' 
                     : process.argv.includes('--qa-only') ? 'qa-chatbot-backend'
                     : 'all';
    
    logger.info(`初始化模式: ${initMode}`, { tables: tablesToInit });

    // 按顺序创建表
    let createdCount = 0;
    let existingCount = 0;

    for (const tableName of tablesToInit) {
      const exists = await tableExists(connection, tableName);
      
      if (exists) {
        logger.info(`表 ${tableName} 已存在，跳过创建`);
        existingCount++;
      } else {
        logger.info(`创建表 ${tableName}...`);
        await connection.execute(allSchemas[tableName]);
        logger.success(`表 ${tableName} 创建成功`);
        createdCount++;
      }
    }

    // 初始化 BusinessScene 初始数据（仅当初始化 kb 相关表时）
    if (initMode === 'all' || initMode === 'kb-backend') {
      await initBusinessSceneData(connection);
    }

    // 初始化 ID 生成器（仅当初始化 qa 相关表时）
    if (initMode === 'all' || initMode === 'qa-chatbot-backend') {
      await initIDGenerator(connection);
    }

    logger.success('\n数据库初始化完成！', {
      创建表数: createdCount,
      已存在表数: existingCount,
      总表数: tableCreationOrder.length
    });

  } catch (error) {
    logger.error('数据库初始化失败', { 
      error: error.message,
      stack: error.stack 
    });
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      logger.info('数据库连接已关闭');
    }
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    logger.error('未捕获的错误', { error: error.message });
    process.exit(1);
  });
}

module.exports = { main, createDatabaseIfNotExists, tableExists };

