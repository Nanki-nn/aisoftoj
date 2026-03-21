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

CREATE TABLE `paper`  (
                          `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键',
                          `paper_cate_id` int(11) DEFAULT NULL COMMENT '试卷分类ID 1-综合题 2-案例题 3-论文题',
                          `name` varchar(255) DEFAULT NULL COMMENT '试卷名称',
                          `order_num` int(11) DEFAULT NULL COMMENT '顺序号,升序排序',
                          `question_total` int(11) DEFAULT NULL COMMENT '题目总数',
                          `read_ct` int(11) DEFAULT 0 COMMENT '阅读数/完成次数',
                          `publish_status` tinyint(1) DEFAULT 0 COMMENT '发布状态：0-未发布，1-已发布',
                          `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '删除状态：0-未删除，1-已删除',
                          `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                          `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                          PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='试卷表';

-- auto-generated definition
create table question
(
    id            int auto_increment comment '主键'
        primary key,
    name          varchar(128)                               not null comment '题目名称（简要描述）',
    intro         longtext                                   null comment '题目内容（含题干、选项等，支持HTML）',
    options       varchar(2048)                              null comment '选项',
    answer        longtext                                   not null comment '标准答案（单选/判断为"A"，多选为"A,B"，填空为"答案1||答案2"）',
    analysis      longtext                                   null comment '题目解析',
    question_type tinyint unsigned default '1'               not null comment '题型: 1-单选, 2-案例, 4-论文',
    difficulty    tinyint unsigned default '2'               not null comment '难度: 1-易, 2-中, 3-难',
    create_time   datetime         default CURRENT_TIMESTAMP null comment '创建时间',
    update_time   datetime         default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP comment '更新时间',
    is_deleted    tinyint(1)       default 0                 not null comment '删除状态，0-未删除，1-已删除',
    read_ct       int unsigned     default '0'               not null comment '被作答次数'
)
    comment '题目表';




CREATE TABLE `paper_question_relation` (
                                           `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
                                           `paper_id`   int(11) NOT NULL   COMMENT '试卷ID',
                                           `question_id` int(11) unsigned NOT NULL COMMENT '题目ID',
                                           `score` decimal(5,2) NOT NULL DEFAULT 1.00 COMMENT '本题分值',
                                           `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                           `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                           PRIMARY KEY (`id`),
                                           UNIQUE KEY `uk_paper_question` (`paper_id`, `question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='试卷-题目关联表';


CREATE TABLE `practice_session` (
                                `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
                                `user_id` int(11) unsigned NOT NULL COMMENT '用户ID',
                                `paper_id` int(11) NOT NULL COMMENT '试卷ID',
                                `start_time` datetime NOT NULL COMMENT '开始答题时间',
                                `end_time` datetime NOT NULL DEFAULT '1970-01-01 00:00:00' COMMENT '结束时间（未完成时为默认值）',
                                `score` decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT '用户得分',
                                `total_score` decimal(5,2) NOT NULL COMMENT '试卷总分',
                                `status` tinyint(3) unsigned NOT NULL DEFAULT 0 COMMENT '状态: 0-进行中, 1-已完成',
                                `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '删除状态：0-未删除，1-已删除',
                                PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户刷题会话表';

CREATE TABLE `practice_session_question_record` (
                                   `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
                                   `session_id` bigint(20) unsigned NOT NULL COMMENT '关联的刷题会话ID（practice_session.id）',
                                   `question_id` int(11) unsigned NOT NULL COMMENT '题目ID',
                                   `user_answer` varchar(255) NOT NULL DEFAULT '' COMMENT '用户作答内容，如 ["A"] 或 ["B","C"]',
                                   `is_submitted` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否已提交：0-未提交，1-已提交',
                                   `is_correct` tinyint(1) DEFAULT NULL COMMENT '是否正确：0-错误，1-正确，NULL-未判分（草稿）',
                                   `spend_time` int(11) unsigned NOT NULL DEFAULT 0 COMMENT '本题耗时（秒）',
                                   `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                   `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                   `is_deleted` tinyint(1) NOT NULL DEFAULT '0' COMMENT '删除状态：0-未删除，1-已删除',
                                   PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户刷题会话-题目答题详情表';
