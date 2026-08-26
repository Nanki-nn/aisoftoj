DROP TABLE IF EXISTS `user_wrong_question_stat`;
DROP TABLE IF EXISTS `practice_session_question_record`;
DROP TABLE IF EXISTS `practice_session`;
DROP TABLE IF EXISTS `paper_question_relation`;
DROP TABLE IF EXISTS `question`;
DROP TABLE IF EXISTS `paper`;
DROP TABLE IF EXISTS `auth_email_outbox`;
DROP TABLE IF EXISTS `auth_email_code`;
DROP TABLE IF EXISTS `auth_rate_limit`;
DROP TABLE IF EXISTS `user`;

CREATE TABLE `user` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `wx_open_id` varchar(64) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '微信OpenID（公众号/小程序）',
  `phone` varchar(20) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '手机号（用于短信登录）',
  `email` varchar(254) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '邮箱（展示值）',
  `email_normalized` varchar(254) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '规范化邮箱（登录唯一标识）',
  `email_verified_at` datetime DEFAULT NULL COMMENT '邮箱验证时间',
  `login_name` varchar(64) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '登录名（可选，用于后台管理）',
  `nick_name` varchar(64) COLLATE utf8mb4_bin NOT NULL DEFAULT '' COMMENT '昵称',
  `avatar` varchar(255) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '头像URL或附件ID',
  `password` varchar(128) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '密码（BCrypt加密，可为空）',
  `token_version` int unsigned NOT NULL DEFAULT 0 COMMENT 'JWT版本，重置密码后递增',
  `role` varchar(16) COLLATE utf8mb4_bin NOT NULL DEFAULT 'USER' COMMENT '用户角色：USER-普通用户，ADMIN-管理员',
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1-启用，0-停用',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '删除状态：0-未删除，1-已删除',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `last_login_time` datetime DEFAULT NULL COMMENT '最近一次成功登录时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wx_open_id` (`wx_open_id`),
  UNIQUE KEY `uk_phone` (`phone`),
  UNIQUE KEY `uk_email` (`email`),
  UNIQUE KEY `uk_email_normalized` (`email_normalized`),
  UNIQUE KEY `uk_login_name` (`login_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='用户表';

CREATE TABLE `auth_email_code` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '验证码ID',
  `email` varchar(254) COLLATE utf8mb4_bin NOT NULL COMMENT '规范化邮箱',
  `scene` varchar(24) COLLATE utf8mb4_bin NOT NULL COMMENT 'REGISTER/PASSWORD_RESET/LOGIN/BIND_EMAIL',
  `code_hash` char(64) COLLATE ascii_bin NOT NULL COMMENT '验证码HMAC-SHA256',
  `code_salt` char(32) COLLATE ascii_bin NOT NULL COMMENT '验证码随机盐',
  `status` varchar(16) COLLATE ascii_bin NOT NULL COMMENT 'PENDING/ACTIVE/CONSUMED/SUPERSEDED/FAILED/SUPPRESSED',
  `expires_at` datetime DEFAULT NULL COMMENT '成功发送后的过期时间',
  `activated_at` datetime DEFAULT NULL COMMENT '成功发送激活时间',
  `consumed_at` datetime DEFAULT NULL COMMENT '消费时间',
  `failed_attempts` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '错误尝试次数',
  `request_ip` varchar(64) COLLATE utf8mb4_bin NOT NULL COMMENT '请求IP',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_auth_email_code_lookup` (`email`, `scene`, `status`, `id`),
  KEY `idx_auth_email_code_expire` (`expires_at`),
  KEY `idx_auth_email_code_created` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='邮箱验证码';

CREATE TABLE `auth_email_outbox` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '发件箱ID',
  `code_id` bigint(20) unsigned NOT NULL COMMENT '验证码ID',
  `email` varchar(254) COLLATE utf8mb4_bin NOT NULL COMMENT '收件邮箱',
  `scene` varchar(24) COLLATE utf8mb4_bin NOT NULL COMMENT '验证码场景',
  `payload_ciphertext` text COLLATE ascii_bin DEFAULT NULL COMMENT 'AES-GCM加密验证码',
  `payload_iv` varchar(32) COLLATE ascii_bin DEFAULT NULL COMMENT 'AES-GCM随机IV',
  `status` varchar(16) COLLATE ascii_bin NOT NULL COMMENT 'PENDING/SENDING/SENT/FAILED',
  `attempt_count` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '发送尝试次数',
  `next_attempt_at` datetime NOT NULL COMMENT '下次尝试时间',
  `locked_at` datetime DEFAULT NULL COMMENT '工作器抢占时间',
  `last_error` varchar(255) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '脱敏错误分类',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_auth_email_outbox_code` (`code_id`),
  KEY `idx_auth_email_outbox_poll` (`status`, `next_attempt_at`, `id`),
  KEY `idx_auth_email_outbox_locked` (`status`, `locked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='认证邮件持久化发件箱';

CREATE TABLE `auth_rate_limit` (
  `limit_key` char(64) COLLATE ascii_bin NOT NULL COMMENT 'HMAC后的限流键',
  `counter` int unsigned NOT NULL DEFAULT 0 COMMENT '当前窗口计数',
  `window_start` datetime NOT NULL COMMENT '窗口开始时间',
  `expires_at` datetime NOT NULL COMMENT '窗口结束时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`limit_key`),
  KEY `idx_auth_rate_limit_expire` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='认证接口原子限流';

CREATE TABLE `paper` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键',
  `front_mock_id` varchar(64) DEFAULT NULL COMMENT '前端mock数据ID',
  `subject_id` int(11) DEFAULT NULL COMMENT '科目ID，兼容现有后端枚举',
  `subject_name` varchar(64) DEFAULT NULL COMMENT '科目名称',
  `paper_cate_id` int(11) DEFAULT NULL COMMENT '试卷分类ID 1-综合知识 2-案例分析 3-论文',
  `paper_year` int(11) DEFAULT NULL COMMENT '试卷年份',
  `paper_month` int(11) DEFAULT NULL COMMENT '试卷月份',
  `name` varchar(255) DEFAULT NULL COMMENT '试卷名称',
  `order_num` int(11) DEFAULT NULL COMMENT '顺序号,升序排序',
  `question_total` int(11) DEFAULT NULL COMMENT '题目总数',
  `read_ct` int(11) DEFAULT 0 COMMENT '阅读数/完成次数',
  `publish_status` tinyint(1) DEFAULT 1 COMMENT '发布状态：0-未发布，1-已发布',
  `mock_status` varchar(32) DEFAULT NULL COMMENT '前端mock状态：not_started/in_progress/completed',
  `completed_count` int(11) DEFAULT 0 COMMENT '前端mock中的已完成题数',
  `source_type` varchar(32) DEFAULT 'mock' COMMENT '数据来源：mock/manual/import',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '删除状态：0-未删除，1-已删除',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_paper_front_mock_id` (`front_mock_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='试卷表';

CREATE TABLE `question` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键',
  `front_mock_id` varchar(64) DEFAULT NULL COMMENT '前端mock数据ID',
  `subject_name` varchar(64) DEFAULT NULL COMMENT '科目名称',
  `category_name` varchar(64) DEFAULT NULL COMMENT '知识点/分类名称',
  `paper_year` int(11) DEFAULT NULL COMMENT '题目年份',
  `name` varchar(128) NOT NULL COMMENT '题目名称（简要描述）',
  `intro` longtext DEFAULT NULL COMMENT '题目内容（含题干、选项等，支持HTML）',
  `options` varchar(2048) DEFAULT NULL COMMENT '选项，JSON数组字符串',
  `answer` longtext NOT NULL COMMENT '标准答案',
  `analysis` longtext DEFAULT NULL COMMENT '题目解析',
  `question_type` tinyint unsigned NOT NULL DEFAULT '1' COMMENT '题型: 1-单选, 2-多选, 3-判断, 4-填空, 5-案例, 6-论文',
  `grading_strategy` varchar(32) NOT NULL DEFAULT 'EXACT_CHOICE' COMMENT 'EXACT_CHOICE/SET_CHOICE/ORDERED_BLANKS/MANUAL',
  `difficulty` tinyint unsigned NOT NULL DEFAULT '2' COMMENT '难度: 1-易, 2-中, 3-难',
  `source_type` varchar(32) DEFAULT 'mock' COMMENT '数据来源：mock/manual/import',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '删除状态，0-未删除，1-已删除',
  `read_ct` int unsigned NOT NULL DEFAULT '0' COMMENT '被作答次数',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_question_front_mock_id` (`front_mock_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='题目表';

CREATE TABLE `paper_question_relation` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `paper_id` int(11) NOT NULL COMMENT '试卷ID',
  `question_id` int(11) unsigned NOT NULL COMMENT '题目ID',
  `score` decimal(5,2) NOT NULL DEFAULT 1.00 COMMENT '本题分值',
  `order_num` int unsigned NOT NULL COMMENT '题目在试卷中的稳定顺序',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_paper_question` (`paper_id`, `question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='试卷-题目关联表';

CREATE TABLE `practice_session` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `front_mock_id` varchar(64) DEFAULT NULL COMMENT '前端mock数据ID',
  `user_id` int(11) unsigned NOT NULL COMMENT '用户ID',
  `paper_id` int(11) NOT NULL COMMENT '试卷ID',
  `exam_mode` varchar(16) NOT NULL DEFAULT 'practice' COMMENT '练习模式：practice/exam',
  `answered_count` int(11) NOT NULL DEFAULT 0 COMMENT '已答题数',
  `start_time` datetime NOT NULL COMMENT '开始答题时间',
  `end_time` datetime NOT NULL DEFAULT '1970-01-01 00:00:00' COMMENT '完成时为结束时间；进行中暂停时为暂停时间，活动时为默认值',
  `score` decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT '用户得分',
  `total_score` decimal(5,2) NOT NULL COMMENT '试卷总分',
  `status` tinyint(3) unsigned NOT NULL DEFAULT 0 COMMENT '状态: 0-进行中, 1-已完成, 2-已合并',
  `merged_into_session_id` bigint(20) unsigned DEFAULT NULL COMMENT '账号合并时指向保留的活动会话',
  `source_type` varchar(32) DEFAULT 'mock' COMMENT '数据来源：mock/manual/import',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '删除状态：0-未删除，1-已删除',
  `active_marker` tinyint(1) GENERATED ALWAYS AS (IF(`status` = 0 AND `is_deleted` = 0, 1, NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_front_mock_id` (`front_mock_id`),
  UNIQUE KEY `uk_practice_session_active` (`user_id`, `paper_id`, `exam_mode`, `active_marker`),
  KEY `idx_practice_session_merged_into` (`merged_into_session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户刷题会话表';

CREATE TABLE `practice_session_question_record` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `session_id` bigint(20) unsigned NOT NULL COMMENT '关联的刷题会话ID（practice_session.id）',
  `question_id` int(11) unsigned NOT NULL COMMENT '题目ID',
  `paper_question_relation_id` int unsigned NOT NULL COMMENT '会话创建时的试卷题目关系',
  `question_order` int unsigned NOT NULL COMMENT '会话创建时固定的题序',
  `score_snapshot` decimal(5,2) NOT NULL COMMENT '会话创建时固定的分值',
  `grading_strategy_snapshot` varchar(32) NOT NULL COMMENT '会话创建时固定的判分策略',
  `user_answer` text DEFAULT NULL COMMENT '用户作答内容，如 A、A,B 或案例长文本',
  `answer_revision` bigint unsigned NOT NULL DEFAULT 0 COMMENT '答案乐观版本号',
  `last_mutation_id` varchar(64) DEFAULT NULL COMMENT '最近一次成功写入的客户端变更标识',
  `confirmed_at` datetime DEFAULT NULL COMMENT '练题模式确认时间',
  `is_submitted` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否已提交：0-未提交，1-已提交',
  `is_correct` tinyint(1) DEFAULT NULL COMMENT '是否正确：0-错误，1-正确，NULL-未判分（草稿）',
  `spend_time` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '本题耗时（秒）',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '删除状态：0-未删除，1-已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_question` (`session_id`, `question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户刷题会话-题目答题详情表';

CREATE TABLE `user_wrong_question_stat` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `source_front_id` varchar(64) DEFAULT NULL COMMENT '前端mock数据ID',
  `source_type` varchar(32) DEFAULT 'wrong_question' COMMENT '来源：wrong_question/practice_record',
  `user_id` int(11) unsigned NOT NULL COMMENT '用户ID',
  `paper_id` int(11) DEFAULT NULL COMMENT '关联试卷ID',
  `question_id` int(11) unsigned DEFAULT NULL COMMENT '关联题目ID，可为空',
  `question_name` varchar(255) NOT NULL COMMENT '错题名称或知识点名称',
  `paper_name` varchar(255) DEFAULT NULL COMMENT '所属题库名称',
  `topic_type` varchar(64) DEFAULT NULL COMMENT '题目类型，如单选题',
  `error_count` int(11) NOT NULL DEFAULT 1 COMMENT '错误次数',
  `importance_level` varchar(16) DEFAULT 'medium' COMMENT '重要级别：low/medium/high/must',
  `last_wrong_time` datetime DEFAULT NULL COMMENT '最后一次错误时间',
  `last_session_id` bigint unsigned DEFAULT NULL COMMENT '最近一次产生该错题的会话ID',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '删除状态：0-未删除，1-已删除',
  `active_marker` tinyint(1) GENERATED ALWAYS AS (IF(`is_deleted` = 0, 1, NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wrong_source_front_id` (`source_front_id`),
  UNIQUE KEY `uk_wrong_question_active` (`user_id`, `question_id`, `active_marker`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户错题聚合统计表';

CREATE TABLE `essay_submission` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `question_id` bigint NOT NULL COMMENT '关联 question 表',
  `abstract` text COMMENT '摘要内容',
  `content` longtext NOT NULL COMMENT '论文正文',
  `word_count` int DEFAULT 0 COMMENT '总字数',
  `status` tinyint DEFAULT 0 COMMENT '0批改中/1已完成/2失败',
  `total_score` decimal(4,1) DEFAULT NULL COMMENT 'AI预测总分',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT 0 COMMENT '软删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='论文提交记录表';

CREATE TABLE `essay_review` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `submission_id` bigint NOT NULL COMMENT '关联 essay_submission',
  `score_abstract` decimal(3,1) DEFAULT NULL COMMENT '摘要质量得分',
  `score_structure` decimal(3,1) DEFAULT NULL COMMENT '结构完整性得分',
  `score_relevance` decimal(3,1) DEFAULT NULL COMMENT '主题相关性得分',
  `score_depth` decimal(3,1) DEFAULT NULL COMMENT '技术深度得分',
  `score_evidence` decimal(3,1) DEFAULT NULL COMMENT '论据充实度得分',
  `score_language` decimal(3,1) DEFAULT NULL COMMENT '语言流畅度得分',
  `total_score` decimal(4,1) DEFAULT NULL COMMENT '综合总分',
  `suggestions` json DEFAULT NULL COMMENT '改进建议数组',
  `raw_response` longtext COMMENT 'AI原始响应备份',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint DEFAULT 0 COMMENT '软删除',
  PRIMARY KEY (`id`),
  INDEX `idx_submission_id` (`submission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI论文批改评分表';

CREATE TABLE `textbook` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '教材主键',
  `subject_name` varchar(64) NOT NULL COMMENT '所属软考科目',
  `name` varchar(255) NOT NULL COMMENT '教材名称',
  `edition` varchar(128) NOT NULL COMMENT '教材版次',
  `isbn` varchar(32) DEFAULT NULL COMMENT 'ISBN',
  `official_url` varchar(1024) NOT NULL COMMENT '官方或授权外部地址',
  `viewer_page_template` varchar(1024) DEFAULT NULL COMMENT '含 {pdfPage} 占位符的页码跳转模板',
  `status` varchar(16) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/ACTIVE/DISABLED',
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0 COMMENT '软删除',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active_marker` varchar(64) GENERATED ALWAYS AS (IF(`status` = 'ACTIVE' AND `is_deleted` = 0, `subject_name`, NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_textbook_active_subject` (`active_marker`),
  KEY `idx_textbook_subject_status` (`subject_name`, `status`, `is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台指定教材';

CREATE TABLE `textbook_section` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `textbook_id` bigint unsigned NOT NULL,
  `parent_id` bigint unsigned DEFAULT NULL,
  `level` tinyint unsigned NOT NULL,
  `section_code` varchar(64) NOT NULL,
  `title` varchar(255) NOT NULL,
  `printed_page_start` int unsigned NOT NULL,
  `printed_page_end` int unsigned NOT NULL,
  `pdf_page_start` int unsigned NOT NULL,
  `pdf_page_end` int unsigned NOT NULL,
  `sort_order` int unsigned NOT NULL DEFAULT 0,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_textbook_section_code` (`textbook_id`, `section_code`),
  KEY `idx_textbook_section_parent` (`textbook_id`, `parent_id`, `sort_order`),
  CONSTRAINT `fk_textbook_section_textbook` FOREIGN KEY (`textbook_id`) REFERENCES `textbook` (`id`),
  CONSTRAINT `fk_textbook_section_parent` FOREIGN KEY (`parent_id`) REFERENCES `textbook_section` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='教材章节与页码映射';

CREATE TABLE `knowledge_point` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `subject_name` varchar(64) NOT NULL,
  `parent_id` bigint unsigned DEFAULT NULL,
  `level` tinyint unsigned NOT NULL,
  `code` varchar(128) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_knowledge_point_code` (`code`),
  KEY `idx_knowledge_point_subject` (`subject_name`, `status`, `is_deleted`),
  KEY `idx_knowledge_point_parent` (`parent_id`),
  CONSTRAINT `fk_knowledge_point_parent` FOREIGN KEY (`parent_id`) REFERENCES `knowledge_point` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台稳定知识点';

CREATE TABLE `knowledge_point_source` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `knowledge_point_id` bigint unsigned NOT NULL,
  `textbook_section_id` bigint unsigned NOT NULL,
  `printed_page_start` int unsigned NOT NULL,
  `printed_page_end` int unsigned NOT NULL,
  `pdf_page_start` int unsigned NOT NULL,
  `pdf_page_end` int unsigned NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_knowledge_point_source` (`knowledge_point_id`, `textbook_section_id`, `printed_page_start`, `pdf_page_start`),
  KEY `idx_knowledge_point_source_section` (`textbook_section_id`, `is_deleted`),
  CONSTRAINT `fk_knowledge_point_source_point` FOREIGN KEY (`knowledge_point_id`) REFERENCES `knowledge_point` (`id`),
  CONSTRAINT `fk_knowledge_point_source_section` FOREIGN KEY (`textbook_section_id`) REFERENCES `textbook_section` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识点到教材章节页码的可信映射';
