-- 1. 业务场景表 (BusinessScene)
CREATE TABLE IF NOT EXISTS `BusinessScene` (
  `business_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '业务id,主键',
  `business` VARCHAR(100) NOT NULL COMMENT '业务名称',
  `scene_id` INT NULL DEFAULT 0 COMMENT '场景ID',
  `scene` VARCHAR(100) NULL DEFAULT NULL COMMENT '场景名称',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`business_id`),
  UNIQUE KEY `uk_business_scene` (`business`, `scene_id`),  -- 联合唯一索引：同一业务下场景ID唯一
  KEY `idx_business_scene` (`business`, `scene`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='业务场景表';

-- 2. 知识库表 (Knowledge)
CREATE TABLE IF NOT EXISTS `Knowledge` (
  `knowledge_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '知识ID',
  `business_id` BIGINT NOT NULL COMMENT '业务ID',
  `type` VARCHAR(50) NOT NULL COMMENT '文件类型（pdf, word, txt, markdown, json等）',
  `file_url` VARCHAR(500) DEFAULT NULL COMMENT '文件访问路径',
  `file_size` BIGINT DEFAULT 0 COMMENT '文件大小（字节）',
  `title` VARCHAR(255) NOT NULL COMMENT '标题',
  `content` TEXT DEFAULT NULL COMMENT '内容',
  `status` VARCHAR(50) NOT NULL DEFAULT '生效中' COMMENT '状态（生效中、已失效等）',
  `refer_num` INT NOT NULL DEFAULT 0 COMMENT '引用次数',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`knowledge_id`),
  KEY `idx_business_id` (`business_id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_title` (`title`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_knowledge_business` FOREIGN KEY (`business_id`) REFERENCES `BusinessScene` (`business_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识库表';


-- 插入业务场景数据
INSERT INTO `BusinessScene` (`business`, `scene_id`, `scene`) VALUES
('经营成长', 0, NULL),
('招商入驻', 0, NULL),
('招商入驻', 1, '保证金管理'),
('招商入驻', 2, '入驻与退出'),
('资金结算', 0, NULL);