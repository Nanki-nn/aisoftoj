package com.nan.aisoftoj.migration;

import org.junit.jupiter.api.Test;
import org.springframework.util.StreamUtils;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SessionSafetyMigrationContractTest {

    @Test
    void v5AddsActiveSessionAndSessionQuestionUniquenessWithPreflightGuards() throws Exception {
        InputStream stream = getClass().getClassLoader().getResourceAsStream(
                "db/migration/V5__add_session_safety_constraints.sql");

        assertNotNull(stream);
        String sql = StreamUtils.copyToString(stream, StandardCharsets.UTF_8)
                .replaceAll("\\s+", " ")
                .toLowerCase();

        assertTrue(sql.contains("create temporary table `migration_v5_preflight_guard`"));
        assertTrue(sql.contains("generated always as (if(`status` = 0 and `is_deleted` = 0, 1, null)) stored"));
        assertTrue(sql.contains("unique key `uk_practice_session_active` (`user_id`, `paper_id`, `exam_mode`, `active_marker`)"));
        assertTrue(sql.contains("unique key `uk_session_question` (`session_id`, `question_id`)"));
    }

    @Test
    void v6AddsRevisionMutationAndConfirmationColumns() throws Exception {
        InputStream stream = getClass().getClassLoader().getResourceAsStream(
                "db/migration/V6__add_answer_revision_columns.sql");

        assertNotNull(stream);
        String sql = StreamUtils.copyToString(stream, StandardCharsets.UTF_8)
                .replaceAll("\\s+", " ")
                .toLowerCase();

        assertTrue(sql.contains("`answer_revision` bigint unsigned not null default 0"));
        assertTrue(sql.contains("`last_mutation_id` varchar(64) default null"));
        assertTrue(sql.contains("`confirmed_at` datetime default null"));
    }
}
