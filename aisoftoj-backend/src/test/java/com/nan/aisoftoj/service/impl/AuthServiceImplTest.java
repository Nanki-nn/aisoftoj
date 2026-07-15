package com.nan.aisoftoj.service.impl;

import cn.hutool.jwt.JWTUtil;
import com.nan.aisoftoj.common.ForbiddenException;
import com.nan.aisoftoj.common.UnauthorizedException;
import com.nan.aisoftoj.common.UserRole;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.mapper.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    private static final String JWT_SECRET = "test-secret-that-is-long-enough-for-admin-authorization";

    @Mock
    private UserMapper userMapper;

    private AuthServiceImpl authService;

    @BeforeEach
    void setUp() {
        authService = new AuthServiceImpl();
        ReflectionTestUtils.setField(authService, "jwtSecret", JWT_SECRET);
        ReflectionTestUtils.setField(authService, "jwtExpireHours", 168L);
        ReflectionTestUtils.setField(authService, "userMapper", userMapper);
    }

    @Test
    void requireAdminReturnsActiveAdminId() {
        User admin = activeUser(UserRole.ADMIN.name());
        when(userMapper.selectById(7)).thenReturn(admin);

        assertEquals(7, authService.requireAdmin(tokenFor(7, System.currentTimeMillis() + 60_000)));
    }

    @Test
    void requireAdminRejectsRegularUser() {
        when(userMapper.selectById(7)).thenReturn(activeUser(UserRole.USER.name()));

        ForbiddenException exception = assertThrows(
                ForbiddenException.class,
                () -> authService.requireAdmin(tokenFor(7, System.currentTimeMillis() + 60_000))
        );
        assertEquals("需要管理员权限", exception.getMessage());
    }

    @Test
    void requireAdminRejectsUnknownOrMissingRole() {
        User user = activeUser(null);
        when(userMapper.selectById(7)).thenReturn(user);
        assertThrows(
                ForbiddenException.class,
                () -> authService.requireAdmin(tokenFor(7, System.currentTimeMillis() + 60_000))
        );

        user.setRole("admin");
        assertThrows(
                ForbiddenException.class,
                () -> authService.requireAdmin(tokenFor(7, System.currentTimeMillis() + 60_000))
        );
    }

    @Test
    void requireAdminRejectsExpiredOrInvalidToken() {
        assertThrows(
                UnauthorizedException.class,
                () -> authService.requireAdmin(tokenFor(7, System.currentTimeMillis() - 1))
        );
        assertThrows(UnauthorizedException.class, () -> authService.requireAdmin("Bearer invalid-token"));
    }

    @Test
    void requireAdminRejectsDisabledDeletedOrMissingUser() {
        User user = activeUser(UserRole.ADMIN.name());
        user.setIsEnabled(false);
        when(userMapper.selectById(7)).thenReturn(user);
        assertThrows(
                UnauthorizedException.class,
                () -> authService.requireAdmin(tokenFor(7, System.currentTimeMillis() + 60_000))
        );

        user.setIsEnabled(true);
        user.setIsDeleted(true);
        assertThrows(
                UnauthorizedException.class,
                () -> authService.requireAdmin(tokenFor(7, System.currentTimeMillis() + 60_000))
        );

        when(userMapper.selectById(7)).thenReturn(null);
        assertThrows(
                UnauthorizedException.class,
                () -> authService.requireAdmin(tokenFor(7, System.currentTimeMillis() + 60_000))
        );
    }

    private User activeUser(String role) {
        User user = new User();
        user.setId(7);
        user.setRole(role);
        user.setIsEnabled(true);
        user.setIsDeleted(false);
        return user;
    }

    private String tokenFor(Integer userId, long expiresAt) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", userId);
        payload.put("exp", expiresAt);
        payload.put("iat", System.currentTimeMillis());
        return JWTUtil.createToken(payload, JWT_SECRET.getBytes(StandardCharsets.UTF_8));
    }
}
