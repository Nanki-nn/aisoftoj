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
  `active_marker` varchar(64) GENERATED ALWAYS AS (
    IF(`status` = 'ACTIVE' AND `is_deleted` = 0, `subject_name`, NULL)
  ) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_textbook_active_subject` (`active_marker`),
  KEY `idx_textbook_subject_status` (`subject_name`, `status`, `is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台指定教材';

CREATE TABLE `textbook_section` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '教材章节主键',
  `textbook_id` bigint unsigned NOT NULL COMMENT '教材 ID',
  `parent_id` bigint unsigned DEFAULT NULL COMMENT '父章节 ID',
  `level` tinyint unsigned NOT NULL COMMENT '章节层级',
  `section_code` varchar(64) NOT NULL COMMENT '稳定章节编号',
  `title` varchar(255) NOT NULL COMMENT '章节标题',
  `printed_page_start` int unsigned NOT NULL COMMENT '印刷起始页',
  `printed_page_end` int unsigned NOT NULL COMMENT '印刷结束页',
  `pdf_page_start` int unsigned NOT NULL COMMENT 'PDF 起始页序号',
  `pdf_page_end` int unsigned NOT NULL COMMENT 'PDF 结束页序号',
  `sort_order` int unsigned NOT NULL DEFAULT 0 COMMENT '同级排序',
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0 COMMENT '软删除',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_textbook_section_code` (`textbook_id`, `section_code`),
  KEY `idx_textbook_section_parent` (`textbook_id`, `parent_id`, `sort_order`),
  CONSTRAINT `fk_textbook_section_textbook` FOREIGN KEY (`textbook_id`) REFERENCES `textbook` (`id`),
  CONSTRAINT `fk_textbook_section_parent` FOREIGN KEY (`parent_id`) REFERENCES `textbook_section` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='教材章节与页码映射';

CREATE TABLE `knowledge_point` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '稳定知识点主键',
  `subject_name` varchar(64) NOT NULL COMMENT '所属软考科目',
  `parent_id` bigint unsigned DEFAULT NULL COMMENT '父知识点 ID',
  `level` tinyint unsigned NOT NULL COMMENT '知识点层级，首版为 1 或 2',
  `code` varchar(128) NOT NULL COMMENT '稳定唯一编码',
  `name` varchar(255) NOT NULL COMMENT '知识点名称',
  `description` text DEFAULT NULL COMMENT '知识点简短定义',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/DISABLED',
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0 COMMENT '软删除',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_knowledge_point_code` (`code`),
  KEY `idx_knowledge_point_subject` (`subject_name`, `status`, `is_deleted`),
  KEY `idx_knowledge_point_parent` (`parent_id`),
  CONSTRAINT `fk_knowledge_point_parent` FOREIGN KEY (`parent_id`) REFERENCES `knowledge_point` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台稳定知识点';

CREATE TABLE `knowledge_point_source` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '知识点出处主键',
  `knowledge_point_id` bigint unsigned NOT NULL COMMENT '知识点 ID',
  `textbook_section_id` bigint unsigned NOT NULL COMMENT '教材章节 ID',
  `printed_page_start` int unsigned NOT NULL COMMENT '印刷起始页',
  `printed_page_end` int unsigned NOT NULL COMMENT '印刷结束页',
  `pdf_page_start` int unsigned NOT NULL COMMENT 'PDF 起始页序号',
  `pdf_page_end` int unsigned NOT NULL COMMENT 'PDF 结束页序号',
  `is_primary` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否为该知识点主要出处',
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0 COMMENT '软删除',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_knowledge_point_source` (`knowledge_point_id`, `textbook_section_id`, `printed_page_start`, `pdf_page_start`),
  KEY `idx_knowledge_point_source_section` (`textbook_section_id`, `is_deleted`),
  CONSTRAINT `fk_knowledge_point_source_point` FOREIGN KEY (`knowledge_point_id`) REFERENCES `knowledge_point` (`id`),
  CONSTRAINT `fk_knowledge_point_source_section` FOREIGN KEY (`textbook_section_id`) REFERENCES `textbook_section` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识点到教材章节页码的可信映射';
