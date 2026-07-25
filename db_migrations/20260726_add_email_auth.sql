-- MySQL 5.7+ 邮箱认证迁移。
-- 执行前必须备份数据库，并确认 20260726_email_auth_preflight.sql 返回空结果。

SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'user' AND COLUMN_NAME = 'email_normalized') = 0,
  'ALTER TABLE `user` ADD COLUMN `email_normalized` varchar(254) COLLATE utf8mb4_bin DEFAULT NULL COMMENT ''规范化邮箱（登录唯一标识）'' AFTER `email`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'user' AND COLUMN_NAME = 'email_verified_at') = 0,
  'ALTER TABLE `user` ADD COLUMN `email_verified_at` datetime DEFAULT NULL COMMENT ''邮箱验证时间'' AFTER `email_normalized`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'user' AND COLUMN_NAME = 'token_version') = 0,
  'ALTER TABLE `user` ADD COLUMN `token_version` int unsigned NOT NULL DEFAULT 0 COMMENT ''JWT版本，重置密码后递增'' AFTER `password`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `user` MODIFY COLUMN `email` varchar(254) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '邮箱（展示值）';

UPDATE `user`
SET `email_normalized` = LOWER(TRIM(`email`)),
    `email_verified_at` = COALESCE(`email_verified_at`, `create_time`, NOW())
WHERE `email` IS NOT NULL AND TRIM(`email`) <> '';

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'user' AND INDEX_NAME = 'uk_email_normalized') = 0,
  'ALTER TABLE `user` ADD UNIQUE KEY `uk_email_normalized` (`email_normalized`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `auth_email_code` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(254) COLLATE utf8mb4_bin NOT NULL,
  `scene` varchar(24) COLLATE utf8mb4_bin NOT NULL,
  `code_hash` char(64) COLLATE ascii_bin NOT NULL,
  `code_salt` char(32) COLLATE ascii_bin NOT NULL,
  `status` varchar(16) COLLATE ascii_bin NOT NULL,
  `expires_at` datetime DEFAULT NULL,
  `activated_at` datetime DEFAULT NULL,
  `consumed_at` datetime DEFAULT NULL,
  `failed_attempts` tinyint unsigned NOT NULL DEFAULT 0,
  `request_ip` varchar(64) COLLATE utf8mb4_bin NOT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_auth_email_code_lookup` (`email`, `scene`, `status`, `id`),
  KEY `idx_auth_email_code_expire` (`expires_at`),
  KEY `idx_auth_email_code_created` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `auth_email_outbox` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code_id` bigint(20) unsigned NOT NULL,
  `email` varchar(254) COLLATE utf8mb4_bin NOT NULL,
  `scene` varchar(24) COLLATE utf8mb4_bin NOT NULL,
  `payload_ciphertext` text COLLATE ascii_bin DEFAULT NULL,
  `payload_iv` varchar(32) COLLATE ascii_bin DEFAULT NULL,
  `status` varchar(16) COLLATE ascii_bin NOT NULL,
  `attempt_count` tinyint unsigned NOT NULL DEFAULT 0,
  `next_attempt_at` datetime NOT NULL,
  `locked_at` datetime DEFAULT NULL,
  `last_error` varchar(255) COLLATE utf8mb4_bin DEFAULT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_auth_email_outbox_code` (`code_id`),
  KEY `idx_auth_email_outbox_poll` (`status`, `next_attempt_at`, `id`),
  KEY `idx_auth_email_outbox_locked` (`status`, `locked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `auth_rate_limit` (
  `limit_key` char(64) COLLATE ascii_bin NOT NULL,
  `counter` int unsigned NOT NULL DEFAULT 0,
  `window_start` datetime NOT NULL,
  `expires_at` datetime NOT NULL,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`limit_key`),
  KEY `idx_auth_rate_limit_expire` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
