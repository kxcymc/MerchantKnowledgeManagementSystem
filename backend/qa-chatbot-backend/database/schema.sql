-- QA Chatbot 业务数据库表结构
-- 数据库：kb_database (可在 KBase 用户下)

-- ============================================
-- 1. 会话表 (Session)
-- ============================================
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话表';

-- ============================================
-- 2. 消息表 (Message)
-- ============================================
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息表';

-- ============================================
-- 3. 消息引用表 (MessageCitation)
-- ============================================
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息引用表';

-- ============================================
-- 4. 问题聚类表 (QuestionCluster)
-- ============================================
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='问题聚类表';

-- ============================================
-- 5. 问题聚类成员表 (QuestionClusterMember)
-- ============================================
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='问题聚类成员表';

-- ============================================
-- 6. 零命中问题表 (ZeroHitQuestion)
-- ============================================
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='零命中问题表（知识库无法回答的问题）';

-- ============================================
-- 7. ID 生成器表 (IDGenerator)
-- ============================================
CREATE TABLE IF NOT EXISTS IDGenerator (
    id_type VARCHAR(32) PRIMARY KEY COMMENT 'ID类型：session_id 或 message_id',
    current_id INT DEFAULT 0 COMMENT '当前最大ID值',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ID生成器表';

-- 初始化 ID 生成器
INSERT INTO IDGenerator (id_type, current_id) VALUES ('session_id', 0)
ON DUPLICATE KEY UPDATE current_id = current_id;
INSERT INTO IDGenerator (id_type, current_id) VALUES ('message_id', 0)
ON DUPLICATE KEY UPDATE current_id = current_id;

