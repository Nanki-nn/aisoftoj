-- 为现有用户记录最近一次成功登录时间。
-- MySQL 5.7 不支持 ADD COLUMN IF NOT EXISTS，因此使用 information_schema 动态 SQL 保证可重复执行。

SET @schema_name = DATABASE();
SET @sql = IF(
  (SELECT COUNT(*)
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name
     AND TABLE_NAME = 'user'
     AND COLUMN_NAME = 'last_login_time') = 0,
  'ALTER TABLE `user` ADD COLUMN `last_login_time` datetime DEFAULT NULL COMMENT ''最近一次成功登录时间'' AFTER `update_time`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT `id`, `email`, `last_login_time`
FROM `user`
WHERE `is_deleted` = 0
ORDER BY `id`;
