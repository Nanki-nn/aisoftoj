ALTER TABLE `practice_session`
  ADD COLUMN `merged_into_session_id` bigint unsigned DEFAULT NULL
    COMMENT '账号合并时指向保留的活动会话' AFTER `status`,
  MODIFY COLUMN `status` tinyint unsigned NOT NULL DEFAULT 0
    COMMENT '状态: 0-进行中, 1-已完成, 2-已合并',
  ADD KEY `idx_practice_session_merged_into` (`merged_into_session_id`);
