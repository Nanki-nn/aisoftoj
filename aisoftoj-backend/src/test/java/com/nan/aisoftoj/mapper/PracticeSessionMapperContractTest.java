package com.nan.aisoftoj.mapper;

import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PracticeSessionMapperContractTest {

    @Test
    void submitLockQueryUsesPessimisticRowLockAndExcludesDeletedSessions() throws Exception {
        Method method = PracticeSessionMapper.class.getMethod("selectByIdForUpdate", Integer.class);
        Select select = method.getAnnotation(Select.class);

        assertNotNull(select);
        String sql = String.join(" ", select.value()).replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
        assertTrue(sql.contains("IS_DELETED = 0"));
        assertTrue(sql.endsWith("FOR UPDATE"));
    }

    @Test
    void historyQueriesExcludeMergedSessions() throws Exception {
        Method list = PracticeSessionMapper.class.getMethod(
                "selectPracticeHistoryByUserId", Integer.class, Integer.class, Integer.class);
        Method count = PracticeSessionMapper.class.getMethod(
                "countPracticeHistoryByUserId", Integer.class);
        Method summary = PracticeSessionMapper.class.getMethod(
                "selectPracticeHistorySummaryByUserId", Integer.class);

        assertExcludesMerged(list.getAnnotation(Select.class));
        assertExcludesMerged(count.getAnnotation(Select.class));
        assertExcludesMerged(summary.getAnnotation(Select.class));
    }

    @Test
    void accountMergeLocksBothUsersSessionsInStableOrder() throws Exception {
        Method method = PracticeSessionMapper.class.getMethod(
                "selectForAccountMerge", Integer.class, Integer.class);
        Select select = method.getAnnotation(Select.class);

        assertNotNull(select);
        String sql = String.join(" ", select.value()).replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
        assertTrue(sql.contains("USER_ID IN (#{FIRSTUSERID}, #{SECONDUSERID})"));
        assertTrue(sql.contains("STATUS IN (0, 1)"));
        assertTrue(sql.contains("ORDER BY USER_ID, ID"));
        assertTrue(sql.endsWith("FOR UPDATE"));
    }

    private void assertExcludesMerged(Select select) {
        assertNotNull(select);
        String sql = String.join(" ", select.value()).replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
        assertTrue(sql.contains("PS.STATUS IN (0, 1)"));
    }
}
