-- Fail before persistent DDL when legacy active rows violate the business key.
CREATE TEMPORARY TABLE `migration_v8_preflight_guard` (
  `guard_key` varchar(64) NOT NULL,
  PRIMARY KEY (`guard_key`)
) ENGINE=MEMORY;

INSERT INTO `migration_v8_preflight_guard` (`guard_key`)
VALUES ('active_wrong_question_unique');

INSERT INTO `migration_v8_preflight_guard` (`guard_key`)
SELECT 'active_wrong_question_unique'
FROM (
  SELECT `user_id`, `question_id`
  FROM `user_wrong_question_stat`
  WHERE `question_id` IS NOT NULL AND `is_deleted` = 0
  GROUP BY `user_id`, `question_id`
  HAVING COUNT(*) > 1
) AS `duplicate_active_wrong_question`
LIMIT 1;

DROP TEMPORARY TABLE `migration_v8_preflight_guard`;

ALTER TABLE `user_wrong_question_stat`
  ADD COLUMN `last_session_id` int unsigned DEFAULT NULL AFTER `last_wrong_time`,
  ADD COLUMN `active_marker` tinyint(1)
    GENERATED ALWAYS AS (IF(`is_deleted` = 0, 1, NULL)) STORED AFTER `is_deleted`,
  ADD UNIQUE KEY `uk_wrong_question_active` (`user_id`, `question_id`, `active_marker`);

UPDATE `user_wrong_question_stat` uwqs
SET `last_session_id` = (
  SELECT psqr.`session_id`
  FROM `practice_session_question_record` psqr
  JOIN `practice_session` ps ON ps.`id` = psqr.`session_id`
  WHERE ps.`user_id` = uwqs.`user_id`
    AND psqr.`question_id` = uwqs.`question_id`
    AND psqr.`is_correct` = 0
    AND psqr.`is_deleted` = 0
    AND ps.`is_deleted` = 0
  ORDER BY psqr.`update_time` DESC, psqr.`id` DESC
  LIMIT 1
)
WHERE uwqs.`question_id` IS NOT NULL
  AND uwqs.`is_deleted` = 0
  AND uwqs.`last_session_id` IS NULL;
