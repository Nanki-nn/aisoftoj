package com.nan.aisoftoj.mapper;

import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PracticeSessionQuestionRecordMapperContractTest {

    @Test
    void sessionRecordsAreReadInTheirSnapshottedOrder() throws Exception {
        Method method = PracticeSessionQuestionRecordMapper.class
                .getMethod("selectBySessionIdOrdered", Integer.class);
        Select select = method.getAnnotation(Select.class);
        assertNotNull(select);

        String sql = normalize(select.value());
        assertTrue(sql.contains("WHERE SESSION_ID = #{SESSIONID}"));
        assertTrue(sql.contains("ORDER BY QUESTION_ORDER, ID"));
    }

    @Test
    void revisionWriteLocksTheRecordAndUsesAnAtomicRevisionPredicate() throws Exception {
        Method lockMethod = PracticeSessionQuestionRecordMapper.class
                .getMethod("selectByIdForUpdate", Integer.class);
        Select select = lockMethod.getAnnotation(Select.class);
        assertNotNull(select);
        assertTrue(normalize(select.value()).endsWith("FOR UPDATE"));

        Method updateMethod = PracticeSessionQuestionRecordMapper.class.getMethod(
                "updateDraftWithRevision",
                Integer.class,
                String.class,
                Integer.class,
                Long.class,
                String.class);
        Update update = updateMethod.getAnnotation(Update.class);
        assertNotNull(update);
        String sql = normalize(update.value());
        assertTrue(sql.contains("ANSWER_REVISION = ANSWER_REVISION + 1"));
        assertTrue(sql.contains("ANSWER_REVISION = #{EXPECTEDREVISION}"));
        assertTrue(sql.contains("CONFIRMED_AT IS NULL"));
        assertTrue(sql.contains("IS_CORRECT = NULL"));
    }

    private String normalize(String[] statements) {
        return String.join(" ", statements)
                .replaceAll("\\s+", " ")
                .toUpperCase(Locale.ROOT);
    }
}
