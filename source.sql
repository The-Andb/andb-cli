CREATE TABLE `helper_article_organized_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `article_uid` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Article unique identifier',
  `category_uid` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Organized category unique identifier',
  `group_type` enum('concepts','guides','bestPractices','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Group type within the category',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Association creation timestamp',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_article_category_group` (`article_uid`,`category_uid`,`group_type`),
  KEY `idx_article_uid` (`article_uid`) USING BTREE,
  KEY `idx_category_uid` (`category_uid`) USING BTREE,
  KEY `idx_group_type` (`group_type`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Junction table for articles and organized categories (many-to-many)'