package com.nan.aisoftoj.migration;

import org.junit.jupiter.api.Test;
import org.springframework.util.StreamUtils;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TextbookTraceMigrationContractTest {

    @Test
    void v10AddsVersionIndependentCatalogAndDualPageMappings() throws Exception {
        InputStream stream = getClass().getClassLoader().getResourceAsStream(
                "db/migration/V10__add_textbook_trace_catalog.sql");

        assertNotNull(stream);
        String sql = StreamUtils.copyToString(stream, StandardCharsets.UTF_8)
                .replaceAll("\\s+", " ")
                .toLowerCase();

        assertTrue(sql.contains("create table `textbook`"));
        assertTrue(sql.contains("create table `textbook_section`"));
        assertTrue(sql.contains("create table `knowledge_point`"));
        assertTrue(sql.contains("create table `knowledge_point_source`"));
        assertTrue(sql.contains("`official_url` varchar(1024) not null"));
        assertTrue(sql.contains("`printed_page_start` int unsigned not null"));
        assertTrue(sql.contains("`pdf_page_start` int unsigned not null"));
        assertTrue(sql.contains("unique key `uk_textbook_active_subject` (`active_marker`)"));
    }
}
