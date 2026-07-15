-- 单次执行迁移：为现有用户增加角色，并授予受控管理员账号 ADMIN。
-- 执行前必须备份数据库；执行后必须确认下面的校验查询只返回一个 ADMIN。

ALTER TABLE `user`
  ADD COLUMN `role` varchar(16) COLLATE utf8mb4_bin NOT NULL DEFAULT 'USER'
  COMMENT '用户角色：USER-普通用户，ADMIN-管理员'
  AFTER `password`;

UPDATE `user`
SET `role` = 'ADMIN'
WHERE `email` = 'admin@aisoftoj.local'
  AND `is_deleted` = 0;

SELECT `id`, `email`, `login_name`, `role`, `is_enabled`, `is_deleted`
FROM `user`
WHERE `role` = 'ADMIN';
