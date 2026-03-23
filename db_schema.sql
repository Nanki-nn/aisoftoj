DROP TABLE IF EXISTS `user_wrong_question_stat`;
DROP TABLE IF EXISTS `practice_session_question_record`;
DROP TABLE IF EXISTS `practice_session`;
DROP TABLE IF EXISTS `paper_question_relation`;
DROP TABLE IF EXISTS `question`;
DROP TABLE IF EXISTS `paper`;
DROP TABLE IF EXISTS `user`;

CREATE TABLE `user` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `wx_open_id` varchar(64) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '微信OpenID（公众号/小程序）',
  `phone` varchar(20) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '手机号（用于短信登录）',
  `email` varchar(64) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '邮箱（备用）',
  `login_name` varchar(64) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '登录名（可选，用于后台管理）',
  `nick_name` varchar(64) COLLATE utf8mb4_bin NOT NULL DEFAULT '' COMMENT '昵称',
  `avatar` varchar(255) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '头像URL或附件ID',
  `password` varchar(128) COLLATE utf8mb4_bin DEFAULT NULL COMMENT '密码（BCrypt加密，可为空）',
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用：1-启用，0-停用',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '删除状态：0-未删除，1-已删除',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wx_open_id` (`wx_open_id`),
  UNIQUE KEY `uk_phone` (`phone`),
  UNIQUE KEY `uk_email` (`email`),
  UNIQUE KEY `uk_login_name` (`login_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='用户表';

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
  `exam_mode` varchar(16) DEFAULT 'practice' COMMENT '练习模式：practice/exam',
  `answered_count` int(11) NOT NULL DEFAULT 0 COMMENT '已答题数',
  `start_time` datetime NOT NULL COMMENT '开始答题时间',
  `end_time` datetime NOT NULL DEFAULT '1970-01-01 00:00:00' COMMENT '结束时间（未完成时为默认值）',
  `score` decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT '用户得分',
  `total_score` decimal(5,2) NOT NULL COMMENT '试卷总分',
  `status` tinyint(3) unsigned NOT NULL DEFAULT 0 COMMENT '状态: 0-进行中, 1-已完成',
  `source_type` varchar(32) DEFAULT 'mock' COMMENT '数据来源：mock/manual/import',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '删除状态：0-未删除，1-已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_front_mock_id` (`front_mock_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户刷题会话表';

CREATE TABLE `practice_session_question_record` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `session_id` bigint(20) unsigned NOT NULL COMMENT '关联的刷题会话ID（practice_session.id）',
  `question_id` int(11) unsigned NOT NULL COMMENT '题目ID',
  `user_answer` varchar(255) NOT NULL DEFAULT '' COMMENT '用户作答内容，如 A 或 A,B',
  `is_submitted` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否已提交：0-未提交，1-已提交',
  `is_correct` tinyint(1) DEFAULT NULL COMMENT '是否正确：0-错误，1-正确，NULL-未判分（草稿）',
  `spend_time` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '本题耗时（秒）',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '删除状态：0-未删除，1-已删除',
  PRIMARY KEY (`id`)
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
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '删除状态：0-未删除，1-已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wrong_source_front_id` (`source_front_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户错题聚合统计表';
