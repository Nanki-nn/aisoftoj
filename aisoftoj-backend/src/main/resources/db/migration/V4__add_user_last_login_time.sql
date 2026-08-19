-- Add the nullable login timestamp without exposing user records in migration output.
-- The conditional statement supports both a V3 database and an already-upgraded legacy database.
SET @schema_name = DATABASE();
SET @add_last_login_time_sql = IF(
  (SELECT COUNT(*)
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name
     AND TABLE_NAME = 'user'
     AND COLUMN_NAME = 'last_login_time') = 0,
  'ALTER TABLE `user` ADD COLUMN `last_login_time` datetime DEFAULT NULL COMMENT ''最近一次成功登录时间'' AFTER `update_time`',
  'DO 0'
);
PREPARE add_last_login_time_stmt FROM @add_last_login_time_sql;
EXECUTE add_last_login_time_stmt;
DEALLOCATE PREPARE add_last_login_time_stmt;
