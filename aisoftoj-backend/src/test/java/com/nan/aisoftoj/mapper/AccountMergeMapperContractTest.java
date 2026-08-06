package com.nan.aisoftoj.mapper;

import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AccountMergeMapperContractTest {

    @Test
    void userPairLockUsesAscendingIds() throws Exception {
        Method method = UserMapper.class.getMethod(
                "selectPairForUpdate", Integer.class, Integer.class);
        Select select = method.getAnnotation(Select.class);

        assertNotNull(select);
        String sql = normalize(select.value());
        assertTrue(sql.contains("ID IN (#{FIRSTUSERID}, #{SECONDUSERID})"));
        assertTrue(sql.contains("ORDER BY ID"));
        assertTrue(sql.endsWith("FOR UPDATE"));
    }

    @Test
    void wrongQuestionRowsLockInStableOrder() throws Exception {
        Method method = UserWrongQuestionStatMapper.class.getMethod(
                "selectForAccountMerge", Integer.class, Integer.class);
        Select select = method.getAnnotation(Select.class);

        assertNotNull(select);
        String sql = normalize(select.value());
        assertTrue(sql.contains("USER_ID IN (#{FIRSTUSERID}, #{SECONDUSERID})"));
        assertTrue(sql.contains("ORDER BY USER_ID, ID"));
        assertTrue(sql.endsWith("FOR UPDATE"));
    }

    @Test
    void answerCopyOnlyFillsBlankTargetAnswersAndBumpsRevision() throws Exception {
        Method method = PracticeSessionQuestionRecordMapper.class.getMethod(
                "copyIntoBlankAnswers", Integer.class, Integer.class);
        Update update = method.getAnnotation(Update.class);

        assertNotNull(update);
        String sql = normalize(update.value());
        assertTrue(sql.contains("TARGET.USER_ANSWER IS NULL OR TARGET.USER_ANSWER = ''"));
        assertTrue(sql.contains("SOURCE.USER_ANSWER IS NOT NULL"));
        assertTrue(sql.contains("GREATEST(TARGET.ANSWER_REVISION, SOURCE.ANSWER_REVISION) + 1"));
    }

    private String normalize(String[] fragments) {
        return String.join(" ", fragments).replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
    }
}
