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
}
