-- Add essay submission and AI review tables for existing databases.

CREATE TABLE IF NOT EXISTS `essay_submission` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `question_id` bigint NOT NULL COMMENT '关联 question 表',
  `abstract` text COMMENT '摘要内容',
  `content` longtext NOT NULL COMMENT '论文正文',
  `word_count` int DEFAULT 0 COMMENT '总字数',
  `status` tinyint DEFAULT 0 COMMENT '0待批改/1批改中/2已完成/3批改失败',
  `total_score` decimal(4,1) DEFAULT NULL COMMENT 'AI预测总分',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT 0 COMMENT '软删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='论文提交记录表';

CREATE TABLE IF NOT EXISTS `essay_review` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `submission_id` bigint NOT NULL COMMENT '关联 essay_submission',
  `score_abstract` decimal(3,1) DEFAULT NULL COMMENT '摘要质量得分',
  `score_structure` decimal(3,1) DEFAULT NULL COMMENT '结构完整性得分',
  `score_relevance` decimal(3,1) DEFAULT NULL COMMENT '主题相关性得分',
  `score_depth` decimal(3,1) DEFAULT NULL COMMENT '技术深度得分',
  `score_evidence` decimal(3,1) DEFAULT NULL COMMENT '论据充实度得分',
  `score_language` decimal(3,1) DEFAULT NULL COMMENT '语言流畅度得分',
  `total_score` decimal(4,1) DEFAULT NULL COMMENT '综合总分',
  `suggestions` json DEFAULT NULL COMMENT '改进建议数组',
  `raw_response` longtext COMMENT 'AI原始响应备份',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT 0 COMMENT '软删除',
  PRIMARY KEY (`id`),
  KEY `idx_submission_id` (`submission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI论文批改评分表';
