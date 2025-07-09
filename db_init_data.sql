-- 用户表初始化数据
INSERT INTO `user` (`username`, `password`, `email`, `phone`, `avatar`, `nickname`, `role`) VALUES
('testuser', '123456', 'testuser@example.com', '13800000000', NULL, '测试用户', 0),
('admin', 'admin123', 'admin@example.com', '13900000000', NULL, '管理员', 1);

-- 题目分类表初始化数据
INSERT INTO `category` (`name`, `parent_id`) VALUES
('软考基础', NULL),
('软件设计', 1),
('网络技术', 1),
('数据库', 1);

-- 题目表初始化数据
INSERT INTO `question` (`content`, `type`, `options`, `answer`, `analysis`, `category_id`, `difficulty`) VALUES
('以下哪项不是操作系统的主要功能？', 1, '{"A":"进程管理","B":"内存管理","C":"编译程序","D":"文件管理"}', 'C', '编译程序属于开发工具，不是操作系统的主要功能。', 1, 1),
('TCP/IP协议中，负责IP地址到MAC地址映射的是？', 1, '{"A":"ARP","B":"RARP","C":"ICMP","D":"UDP"}', 'A', 'ARP协议用于IP地址到MAC地址的映射。', 3, 1),
('关系数据库的三大范式中，第一范式要求？', 1, '{"A":"无重复行","B":"无部分依赖","C":"无传递依赖","D":"属性不可再分"}', 'D', '第一范式要求属性不可再分。', 4, 1);

-- 用户收藏表初始化数据
INSERT INTO `user_favorite` (`user_id`, `question_id`) VALUES
(1, 1),
(1, 2);

-- 用户错题本表初始化数据
INSERT INTO `user_wrong_question` (`user_id`, `question_id`) VALUES
(1, 2),
(2, 3);

-- 用户刷题记录表初始化数据
INSERT INTO `user_record` (`user_id`, `question_id`, `user_answer`, `is_correct`) VALUES
(1, 1, 'C', 1),
(1, 2, 'B', 0),
(2, 3, 'A', 0); 