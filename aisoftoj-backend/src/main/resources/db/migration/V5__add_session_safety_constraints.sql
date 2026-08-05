-- Fail before persistent DDL when legacy data would violate the new unique keys.
CREATE TEMPORARY TABLE `migration_v5_preflight_guard` (
  `guard_key` varchar(64) NOT NULL,
  PRIMARY KEY (`guard_key`)
) ENGINE=MEMORY;

INSERT INTO `migration_v5_preflight_guard` (`guard_key`)
VALUES ('active_session_unique');

INSERT INTO `migration_v5_preflight_guard` (`guard_key`)
SELECT 'active_session_unique'
FROM (
  SELECT
    `user_id`,
    `paper_id`,
    COALESCE(NULLIF(TRIM(`exam_mode`), ''), 'practice') AS `normalized_exam_mode`
  FROM `practice_session`
  WHERE `status` = 0 AND `is_deleted` = 0
  GROUP BY
    `user_id`,
    `paper_id`,
    COALESCE(NULLIF(TRIM(`exam_mode`), ''), 'practice')
  HAVING COUNT(*) > 1
) AS `duplicate_active_session`
LIMIT 1;

DELETE FROM `migration_v5_preflight_guard`;

INSERT INTO `migration_v5_preflight_guard` (`guard_key`)
VALUES ('session_question_unique');

INSERT INTO `migration_v5_preflight_guard` (`guard_key`)
SELECT 'session_question_unique'
FROM (
  SELECT `session_id`, `question_id`
  FROM `practice_session_question_record`
  GROUP BY `session_id`, `question_id`
  HAVING COUNT(*) > 1
) AS `duplicate_session_question`
LIMIT 1;

DROP TEMPORARY TABLE `migration_v5_preflight_guard`;

UPDATE `practice_session`
SET `exam_mode` = 'practice'
WHERE `exam_mode` IS NULL OR TRIM(`exam_mode`) = '';

ALTER TABLE `practice_session`
  MODIFY COLUMN `exam_mode` varchar(16) NOT NULL DEFAULT 'practice' COMMENT '练习模式：practice/exam';

SET @schema_name = DATABASE();

SET @add_active_marker_sql = IF(
  (SELECT COUNT(*)
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name
     AND TABLE_NAME = 'practice_session'
     AND COLUMN_NAME = 'active_marker') = 0,
  'ALTER TABLE `practice_session` ADD COLUMN `active_marker` tinyint(1) GENERATED ALWAYS AS (IF(`status` = 0 AND `is_deleted` = 0, 1, NULL)) STORED AFTER `is_deleted`',
  'DO 0'
);
PREPARE add_active_marker_stmt FROM @add_active_marker_sql;
EXECUTE add_active_marker_stmt;
DEALLOCATE PREPARE add_active_marker_stmt;

SET @add_active_session_unique_sql = IF(
  (SELECT COUNT(*)
   FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = @schema_name
     AND TABLE_NAME = 'practice_session'
     AND INDEX_NAME = 'uk_practice_session_active') = 0,
  'ALTER TABLE `practice_session` ADD UNIQUE KEY `uk_practice_session_active` (`user_id`, `paper_id`, `exam_mode`, `active_marker`)',
  'DO 0'
);
PREPARE add_active_session_unique_stmt FROM @add_active_session_unique_sql;
EXECUTE add_active_session_unique_stmt;
DEALLOCATE PREPARE add_active_session_unique_stmt;

SET @add_session_question_unique_sql = IF(
  (SELECT COUNT(*)
   FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = @schema_name
     AND TABLE_NAME = 'practice_session_question_record'
     AND INDEX_NAME = 'uk_session_question') = 0,
  'ALTER TABLE `practice_session_question_record` ADD UNIQUE KEY `uk_session_question` (`session_id`, `question_id`)',
  'DO 0'
);
PREPARE add_session_question_unique_stmt FROM @add_session_question_unique_sql;
EXECUTE add_session_question_unique_stmt;
DEALLOCATE PREPARE add_session_question_unique_stmt;
