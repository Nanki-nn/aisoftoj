SET @schema_name = DATABASE();

SET @add_answer_revision_sql = IF(
  (SELECT COUNT(*)
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name
     AND TABLE_NAME = 'practice_session_question_record'
     AND COLUMN_NAME = 'answer_revision') = 0,
  'ALTER TABLE `practice_session_question_record` ADD COLUMN `answer_revision` bigint unsigned NOT NULL DEFAULT 0 AFTER `user_answer`',
  'DO 0'
);
PREPARE add_answer_revision_stmt FROM @add_answer_revision_sql;
EXECUTE add_answer_revision_stmt;
DEALLOCATE PREPARE add_answer_revision_stmt;

SET @add_last_mutation_id_sql = IF(
  (SELECT COUNT(*)
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name
     AND TABLE_NAME = 'practice_session_question_record'
     AND COLUMN_NAME = 'last_mutation_id') = 0,
  'ALTER TABLE `practice_session_question_record` ADD COLUMN `last_mutation_id` varchar(64) DEFAULT NULL AFTER `answer_revision`',
  'DO 0'
);
PREPARE add_last_mutation_id_stmt FROM @add_last_mutation_id_sql;
EXECUTE add_last_mutation_id_stmt;
DEALLOCATE PREPARE add_last_mutation_id_stmt;

SET @add_confirmed_at_sql = IF(
  (SELECT COUNT(*)
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @schema_name
     AND TABLE_NAME = 'practice_session_question_record'
     AND COLUMN_NAME = 'confirmed_at') = 0,
  'ALTER TABLE `practice_session_question_record` ADD COLUMN `confirmed_at` datetime DEFAULT NULL AFTER `last_mutation_id`',
  'DO 0'
);
PREPARE add_confirmed_at_stmt FROM @add_confirmed_at_sql;
EXECUTE add_confirmed_at_stmt;
DEALLOCATE PREPARE add_confirmed_at_stmt;
