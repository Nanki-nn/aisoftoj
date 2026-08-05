package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.auth.EmailCodeScene;
import com.nan.aisoftoj.common.ConflictException;
import com.nan.aisoftoj.common.UserRole;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.service.EmailCodeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;

import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailBindingServiceTest {
    @Mock
    private UserMapper userMapper;
    @Mock
    private EmailCodeService emailCodeService;

    private EmailBindingService service;

    @BeforeEach
    void setUp() {
        service = new EmailBindingService(userMapper, emailCodeService);
    }

    @Test
    void bindsNewEmailAfterLockingUserAndConsumingCode() {
        User current = wxOnlyUser();
        when(userMapper.selectByIdForUpdate(7)).thenReturn(current);
        when(userMapper.selectAnyByNormalizedEmailForUpdate("user@example.com")).thenReturn(null);
        when(userMapper.updateById(current)).thenReturn(1);

        User bound = service.bind(7, " USER@example.com ", "123456");

        assertSame(current, bound);
        assertEquals("user@example.com", current.getEmail());
        assertEquals("user@example.com", current.getEmailNormalized());
        assertNotNull(current.getEmailVerifiedAt());
        verify(emailCodeService).consumeCode(
                "user@example.com", EmailCodeScene.BIND_EMAIL, "123456");
        verify(userMapper).updateById(current);
    }

    @Test
    void existingAccountIsAnExplicitConflictWithoutPartialMigration() {
        User current = wxOnlyUser();
        User existing = activeUser(9, UserRole.USER.name());
        existing.setEmailNormalized("user@example.com");
        existing.setEmailVerifiedAt(new Date());
        when(userMapper.selectByIdForUpdate(7)).thenReturn(current);
        when(userMapper.selectAnyByNormalizedEmailForUpdate("user@example.com"))
                .thenReturn(existing);

        assertThrows(ConflictException.class,
                () -> service.bind(7, "user@example.com", "123456"));

        verify(emailCodeService).consumeCode(
                "user@example.com", EmailCodeScene.BIND_EMAIL, "123456");
        verify(userMapper, never()).updateById(current);
        verify(userMapper, never()).updateById(existing);
    }

    @Test
    void sameBoundEmailIsIdempotentAfterWechatRelogin() {
        User current = wxOnlyUser();
        current.setEmail("user@example.com");
        current.setEmailNormalized("user@example.com");
        current.setEmailVerifiedAt(new Date());
        when(userMapper.selectByIdForUpdate(7)).thenReturn(current);

        assertSame(current, service.bind(7, "USER@example.com", "unused"));
        verify(emailCodeService, never()).consumeCode(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString());
        verify(userMapper, never()).updateById(current);
    }

    @Test
    void rejectsNonWxOnlyCallerBeforeConsumingCode() {
        User admin = activeUser(7, UserRole.ADMIN.name());
        admin.setWxOpenId("openid-1");
        when(userMapper.selectByIdForUpdate(7)).thenReturn(admin);

        assertThrows(IllegalArgumentException.class,
                () -> service.bind(7, "user@example.com", "123456"));
        verify(emailCodeService, never()).consumeCode(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void concurrentEmailClaimBecomesConflictInsteadOfOverwrite() {
        User current = wxOnlyUser();
        when(userMapper.selectByIdForUpdate(7)).thenReturn(current);
        when(userMapper.selectAnyByNormalizedEmailForUpdate("user@example.com")).thenReturn(null);
        doThrow(new DuplicateKeyException("uk_email_normalized"))
                .when(userMapper).updateById(current);

        assertThrows(ConflictException.class,
                () -> service.bind(7, "user@example.com", "123456"));

        verify(emailCodeService).consumeCode(
                "user@example.com", EmailCodeScene.BIND_EMAIL, "123456");
    }

    private User wxOnlyUser() {
        User user = activeUser(7, UserRole.USER.name());
        user.setWxOpenId("openid-1");
        return user;
    }

    private User activeUser(int id, String role) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        user.setIsEnabled(true);
        user.setIsDeleted(false);
        user.setTokenVersion(0);
        return user;
    }
}
