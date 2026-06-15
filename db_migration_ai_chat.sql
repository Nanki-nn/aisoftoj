CREATE TABLE IF NOT EXISTS `ai_chat_session` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '会话ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `title` varchar(128) NOT NULL DEFAULT '新对话' COMMENT '会话标题',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint NOT NULL DEFAULT 0 COMMENT '软删除',
  PRIMARY KEY (`id`),
  INDEX `idx_ai_chat_session_user_time` (`user_id`, `is_deleted`, `update_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI问答会话';

CREATE TABLE IF NOT EXISTS `ai_chat_message` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '消息ID',
  `session_id` bigint NOT NULL COMMENT '会话ID',
  `role` varchar(16) NOT NULL COMMENT 'user/assistant',
  `content` longtext NOT NULL COMMENT '消息内容',
  `web_enabled` tinyint NOT NULL DEFAULT 0 COMMENT '是否启用联网',
  `thinking_enabled` tinyint NOT NULL DEFAULT 0 COMMENT '是否启用思考模式',
  `reasoning_content` longtext DEFAULT NULL COMMENT '模型思考内容',
  `status` varchar(16) NOT NULL DEFAULT 'completed' COMMENT 'streaming/completed/failed',
  `citations` json DEFAULT NULL COMMENT '引用来源',
  `error_message` varchar(512) DEFAULT NULL COMMENT '失败原因',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ai_chat_message_session` (`session_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI问答消息';

SET @thinking_column_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ai_chat_message'
    AND COLUMN_NAME = 'thinking_enabled'
);
SET @thinking_sql = IF(
  @thinking_column_exists = 0,
  'ALTER TABLE `ai_chat_message` ADD COLUMN `thinking_enabled` tinyint NOT NULL DEFAULT 0 COMMENT ''是否启用思考模式'' AFTER `web_enabled`',
  'SELECT 1'
);
PREPARE thinking_stmt FROM @thinking_sql;
EXECUTE thinking_stmt;
DEALLOCATE PREPARE thinking_stmt;

SET @reasoning_column_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ai_chat_message'
    AND COLUMN_NAME = 'reasoning_content'
);
SET @reasoning_sql = IF(
  @reasoning_column_exists = 0,
  'ALTER TABLE `ai_chat_message` ADD COLUMN `reasoning_content` longtext DEFAULT NULL COMMENT ''模型思考内容'' AFTER `thinking_enabled`',
  'SELECT 1'
);
PREPARE reasoning_stmt FROM @reasoning_sql;
EXECUTE reasoning_stmt;
DEALLOCATE PREPARE reasoning_stmt;
