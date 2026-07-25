-- 邮箱认证迁移前检查。返回任何记录时必须先人工处理，不能继续执行迁移。
SELECT LOWER(TRIM(`email`)) AS `email_normalized`, COUNT(*) AS `account_count`,
       GROUP_CONCAT(`id` ORDER BY `id`) AS `user_ids`
FROM `user`
WHERE `email` IS NOT NULL AND TRIM(`email`) <> '' AND `is_deleted` = 0
GROUP BY LOWER(TRIM(`email`))
HAVING COUNT(*) > 1;

SELECT `id`, `email`
FROM `user`
WHERE `email` IS NOT NULL AND CHAR_LENGTH(TRIM(`email`)) > 254;
