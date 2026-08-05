-- Refuse a partial snapshot migration when a historical record no longer has
-- an unambiguous paper relation. The duplicate primary-key insert fails before
-- any persistent DDL is applied.
CREATE TEMPORARY TABLE `migration_v7_preflight_guard` (
  `guard_key` varchar(64) NOT NULL,
  PRIMARY KEY (`guard_key`)
) ENGINE=MEMORY;

INSERT INTO `migration_v7_preflight_guard` (`guard_key`)
VALUES ('session_question_relation_present');

INSERT INTO `migration_v7_preflight_guard` (`guard_key`)
SELECT 'session_question_relation_present'
FROM `practice_session_question_record` psqr
JOIN `practice_session` ps ON ps.id = psqr.session_id
LEFT JOIN `paper_question_relation` pqr
  ON pqr.paper_id = ps.paper_id AND pqr.question_id = psqr.question_id
WHERE pqr.id IS NULL
LIMIT 1;

DELETE FROM `migration_v7_preflight_guard`;

INSERT INTO `migration_v7_preflight_guard` (`guard_key`)
VALUES ('question_type_supported');

INSERT INTO `migration_v7_preflight_guard` (`guard_key`)
SELECT 'question_type_supported'
FROM `question`
WHERE `question_type` NOT IN (1, 2, 3, 4, 5, 6)
   OR `question_type` IS NULL
LIMIT 1;

DROP TEMPORARY TABLE `migration_v7_preflight_guard`;

ALTER TABLE `paper_question_relation`
  ADD COLUMN `order_num` int unsigned NULL COMMENT '题目在试卷中的稳定顺序' AFTER `score`;

UPDATE `paper_question_relation` target
JOIN (
  SELECT current_relation.id, COUNT(previous_relation.id) AS order_num
  FROM `paper_question_relation` current_relation
  JOIN `paper_question_relation` previous_relation
    ON previous_relation.paper_id = current_relation.paper_id
   AND previous_relation.id <= current_relation.id
  GROUP BY current_relation.id
) ranked ON ranked.id = target.id
SET target.order_num = ranked.order_num;

ALTER TABLE `paper_question_relation`
  MODIFY COLUMN `order_num` int unsigned NOT NULL COMMENT '题目在试卷中的稳定顺序';

ALTER TABLE `question`
  ADD COLUMN `grading_strategy` varchar(32) NULL COMMENT 'EXACT_CHOICE/SET_CHOICE/ORDERED_BLANKS/MANUAL' AFTER `question_type`;

UPDATE `question`
SET `grading_strategy` = CASE `question_type`
  WHEN 1 THEN 'EXACT_CHOICE'
  WHEN 2 THEN 'SET_CHOICE'
  WHEN 3 THEN 'EXACT_CHOICE'
  WHEN 4 THEN 'ORDERED_BLANKS'
  WHEN 5 THEN 'MANUAL'
  WHEN 6 THEN 'MANUAL'
  ELSE NULL
END;

ALTER TABLE `question`
  MODIFY COLUMN `grading_strategy` varchar(32) NOT NULL COMMENT 'EXACT_CHOICE/SET_CHOICE/ORDERED_BLANKS/MANUAL';

ALTER TABLE `practice_session_question_record`
  ADD COLUMN `paper_question_relation_id` int unsigned NULL COMMENT '会话创建时的试卷题目关系' AFTER `question_id`,
  ADD COLUMN `question_order` int unsigned NULL COMMENT '会话创建时固定的题序' AFTER `paper_question_relation_id`,
  ADD COLUMN `score_snapshot` decimal(5,2) NULL COMMENT '会话创建时固定的分值' AFTER `question_order`,
  ADD COLUMN `grading_strategy_snapshot` varchar(32) NULL COMMENT '会话创建时固定的判分策略' AFTER `score_snapshot`;

UPDATE `practice_session_question_record` psqr
JOIN `practice_session` ps ON ps.id = psqr.session_id
JOIN `paper_question_relation` pqr
  ON pqr.paper_id = ps.paper_id AND pqr.question_id = psqr.question_id
JOIN `question` q ON q.id = psqr.question_id
SET psqr.paper_question_relation_id = pqr.id,
    psqr.question_order = pqr.order_num,
    psqr.score_snapshot = pqr.score,
    psqr.grading_strategy_snapshot = q.grading_strategy;

ALTER TABLE `practice_session_question_record`
  MODIFY COLUMN `paper_question_relation_id` int unsigned NOT NULL COMMENT '会话创建时的试卷题目关系',
  MODIFY COLUMN `question_order` int unsigned NOT NULL COMMENT '会话创建时固定的题序',
  MODIFY COLUMN `score_snapshot` decimal(5,2) NOT NULL COMMENT '会话创建时固定的分值',
  MODIFY COLUMN `grading_strategy_snapshot` varchar(32) NOT NULL COMMENT '会话创建时固定的判分策略',
  MODIFY COLUMN `user_answer` text NULL COMMENT '用户作答内容';
