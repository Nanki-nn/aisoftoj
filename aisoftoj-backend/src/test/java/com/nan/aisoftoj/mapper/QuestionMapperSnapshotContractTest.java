package com.nan.aisoftoj.mapper;

import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class QuestionMapperSnapshotContractTest {

    @Test
    void paperSnapshotQueryCarriesStableRelationScoreStrategyAndOrder() throws Exception {
        Method method = QuestionMapper.class
                .getMethod("selectSessionQuestionSnapshotsByPaperId", Integer.class);
        Select select = method.getAnnotation(Select.class);
        assertNotNull(select);

        String sql = String.join(" ", select.value())
                .replaceAll("\\s+", " ")
                .toUpperCase(Locale.ROOT);
        assertTrue(sql.contains("PQR.ID AS PAPERQUESTIONRELATIONID"));
        assertTrue(sql.contains("PQR.SCORE AS SCORESNAPSHOT"));
        assertTrue(sql.contains("Q.GRADING_STRATEGY AS GRADINGSTRATEGYSNAPSHOT"));
        assertTrue(sql.contains("ORDER BY PQR.ORDER_NUM, PQR.ID"));
    }

    @Test
    void sessionSnapshotQueryReadsTheFrozenOrderWithoutReenumeratingPaperRelations() throws Exception {
        Method method = QuestionMapper.class
                .getMethod("selectSessionQuestionSnapshotsBySessionId", Integer.class);
        Select select = method.getAnnotation(Select.class);
        assertNotNull(select);

        String sql = String.join(" ", select.value())
                .replaceAll("\\s+", " ")
                .toUpperCase(Locale.ROOT);
        assertTrue(sql.contains("FROM PRACTICE_SESSION_QUESTION_RECORD PSQR"));
        assertTrue(sql.contains("PSQR.SCORE_SNAPSHOT AS SCORESNAPSHOT"));
        assertTrue(sql.contains("ORDER BY PSQR.QUESTION_ORDER, PSQR.ID"));
        assertTrue(!sql.contains("JOIN PAPER_QUESTION_RELATION"));
    }
}
