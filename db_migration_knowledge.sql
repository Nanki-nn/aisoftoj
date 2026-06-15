-- Production knowledge-base migration for MySQL 5.7+.
-- This script is safe for both a fresh database and the previous single-list schema.

CREATE TABLE IF NOT EXISTS `knowledge_base` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `vector_id` varchar(64) NOT NULL,
  `name` varchar(64) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `color` varchar(32) NOT NULL DEFAULT '#2563eb',
  `is_default` tinyint NOT NULL DEFAULT 0,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_knowledge_base_vector_id` (`vector_id`),
  KEY `idx_knowledge_base_user` (`user_id`, `is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `knowledge_document` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `knowledge_base_ref_id` bigint DEFAULT NULL,
  `knowledge_base_id` varchar(64) NOT NULL,
  `document_id` varchar(64) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_type` varchar(16) NOT NULL,
  `file_size` bigint NOT NULL DEFAULT 0,
  `storage_path` varchar(512) NOT NULL,
  `job_id` varchar(160) DEFAULT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'uploaded',
  `chunk_count` int NOT NULL DEFAULT 0,
  `version` int NOT NULL DEFAULT 1,
  `error_message` varchar(2000) DEFAULT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_knowledge_document_id` (`document_id`),
  KEY `idx_knowledge_document_user_status` (`user_id`, `is_deleted`, `status`),
  KEY `idx_knowledge_document_base` (`knowledge_base_ref_id`, `is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$
DROP PROCEDURE IF EXISTS `ensure_knowledge_column`$$
CREATE PROCEDURE `ensure_knowledge_column`(
  IN table_name_value varchar(64),
  IN column_name_value varchar(64),
  IN definition_value varchar(1000)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_value
      AND COLUMN_NAME = column_name_value
  ) THEN
    SET @ddl = CONCAT(
      'ALTER TABLE `', table_name_value, '` ADD COLUMN `',
      column_name_value, '` ', definition_value
    );
    PREPARE statement_value FROM @ddl;
    EXECUTE statement_value;
    DEALLOCATE PREPARE statement_value;
  END IF;
END$$

DROP PROCEDURE IF EXISTS `ensure_knowledge_index`$$
CREATE PROCEDURE `ensure_knowledge_index`(
  IN table_name_value varchar(64),
  IN index_name_value varchar(64),
  IN columns_value varchar(1000)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_value
      AND INDEX_NAME = index_name_value
  ) THEN
    SET @ddl = CONCAT(
      'ALTER TABLE `', table_name_value, '` ADD INDEX `',
      index_name_value, '` (', columns_value, ')'
    );
    PREPARE statement_value FROM @ddl;
    EXECUTE statement_value;
    DEALLOCATE PREPARE statement_value;
  END IF;
END$$
DELIMITER ;

CALL ensure_knowledge_column('knowledge_document', 'knowledge_base_ref_id', 'bigint DEFAULT NULL AFTER `user_id`');
CALL ensure_knowledge_column('knowledge_document', 'version', 'int NOT NULL DEFAULT 1 AFTER `chunk_count`');
CALL ensure_knowledge_index('knowledge_document', 'idx_knowledge_document_base', '`knowledge_base_ref_id`, `is_deleted`');
ALTER TABLE `knowledge_document`
  MODIFY COLUMN `job_id` varchar(160) DEFAULT NULL,
  MODIFY COLUMN `status` varchar(24) NOT NULL DEFAULT 'uploaded',
  MODIFY COLUMN `error_message` varchar(2000) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS `knowledge_document_version` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `document_id` bigint NOT NULL,
  `version` int NOT NULL,
  `ai_job_id` varchar(160) DEFAULT NULL,
  `mineru_task_id` varchar(160) DEFAULT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'uploaded',
  `progress` int NOT NULL DEFAULT 0,
  `queued_ahead` int DEFAULT NULL,
  `chunk_count` int NOT NULL DEFAULT 0,
  `options_json` longtext NOT NULL,
  `error_message` varchar(2000) DEFAULT NULL,
  `markdown_path` varchar(512) DEFAULT NULL,
  `content_list_path` varchar(512) DEFAULT NULL,
  `raw_result_path` varchar(512) DEFAULT NULL,
  `chunks_path` varchar(512) DEFAULT NULL,
  `trace_id` varchar(64) DEFAULT NULL,
  `failure_type` varchar(64) DEFAULT NULL,
  `stage_duration_ms` bigint DEFAULT NULL,
  `total_duration_ms` bigint DEFAULT NULL,
  `started_time` datetime DEFAULT NULL,
  `completed_time` datetime DEFAULT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_document_version` (`document_id`, `version`),
  KEY `idx_document_version_status` (`status`, `update_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CALL ensure_knowledge_column('knowledge_document_version', 'trace_id', 'varchar(64) DEFAULT NULL AFTER `chunks_path`');
CALL ensure_knowledge_column('knowledge_document_version', 'failure_type', 'varchar(64) DEFAULT NULL AFTER `trace_id`');
CALL ensure_knowledge_column('knowledge_document_version', 'stage_duration_ms', 'bigint DEFAULT NULL AFTER `failure_type`');
CALL ensure_knowledge_column('knowledge_document_version', 'total_duration_ms', 'bigint DEFAULT NULL AFTER `stage_duration_ms`');

DROP PROCEDURE `ensure_knowledge_column`;
DROP PROCEDURE `ensure_knowledge_index`;

CREATE TABLE IF NOT EXISTS `ai_chat_session_knowledge_base` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` bigint NOT NULL,
  `knowledge_base_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_chat_session_base` (`session_id`, `knowledge_base_id`),
  KEY `idx_chat_base` (`knowledge_base_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `knowledge_base`
  (`user_id`, `vector_id`, `name`, `description`, `color`, `is_default`)
SELECT DISTINCT d.user_id, CONCAT('user-', d.user_id), '个人知识库',
       '自动迁移的个人备考资料', '#2563eb', 1
FROM `knowledge_document` d
LEFT JOIN `knowledge_base` b
  ON b.user_id = d.user_id AND b.is_default = 1 AND b.is_deleted = 0
WHERE b.id IS NULL;

UPDATE `knowledge_document` d
JOIN `knowledge_base` b
  ON b.user_id = d.user_id AND b.is_default = 1 AND b.is_deleted = 0
SET d.knowledge_base_ref_id = b.id,
    d.knowledge_base_id = b.vector_id
WHERE d.knowledge_base_ref_id IS NULL;

INSERT IGNORE INTO `knowledge_document_version`
  (`document_id`, `version`, `ai_job_id`, `status`, `progress`, `chunk_count`,
   `options_json`, `error_message`, `create_time`, `update_time`)
SELECT id, version, job_id, status,
       CASE WHEN status = 'ready' THEN 100 WHEN status = 'failed' THEN 0 ELSE 10 END,
       chunk_count,
       '{"backend":"hybrid-engine","effort":"medium","parse_method":"auto","lang_list":["ch"],"formula_enable":true,"table_enable":true,"image_analysis":false,"return_md":true,"return_content_list":true,"return_images":true,"chunk_size":800,"chunk_overlap":120}',
       error_message, create_time, update_time
FROM `knowledge_document`;
