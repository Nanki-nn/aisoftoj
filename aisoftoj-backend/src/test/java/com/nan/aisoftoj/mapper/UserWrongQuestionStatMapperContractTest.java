package com.nan.aisoftoj.mapper;

import com.nan.aisoftoj.entity.UserWrongQuestionStat;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UserWrongQuestionStatMapperContractTest {

    @Test
    void wrongQuestionWritesUseOneAtomicBusinessKeyUpsert() throws Exception {
        Method method = UserWrongQuestionStatMapper.class.getMethod(
                "upsertActiveWrongQuestion",
                UserWrongQuestionStat.class);
        Insert insert = method.getAnnotation(Insert.class);
        assertNotNull(insert);

        String sql = normalize(insert.value());
        assertTrue(sql.contains("ON DUPLICATE KEY UPDATE"));
        assertTrue(sql.contains("ERROR_COUNT = ERROR_COUNT + 1"));
        assertTrue(sql.contains("LAST_SESSION_ID = CASE"));
        assertTrue(sql.contains("IMPORTANCE_LEVEL = CASE"));
        assertTrue(sql.contains("IS_DELETED = 0"));
    }

    @Test
    void wrongQuestionListReadsThePersistedOriginSession() throws Exception {
        Method method = UserWrongQuestionStatMapper.class.getMethod(
                "selectByUserId",
                Integer.class,
                Integer.class,
                Integer.class);
        Select select = method.getAnnotation(Select.class);
        assertNotNull(select);

        String sql = normalize(select.value());
        assertTrue(sql.contains("LAST_SESSION_ID AS SESSIONID"));
        assertFalse(sql.contains("PRACTICE_SESSION_QUESTION_RECORD"));
    }

    private String normalize(String[] statements) {
        return String.join(" ", statements)
                .replaceAll("\\s+", " ")
                .toUpperCase(Locale.ROOT);
    }
}
