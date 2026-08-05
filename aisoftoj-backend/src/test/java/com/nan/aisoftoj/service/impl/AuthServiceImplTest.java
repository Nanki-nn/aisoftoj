package com.nan.aisoftoj.service.impl;

import cn.hutool.jwt.JWTUtil;
import com.nan.aisoftoj.auth.EmailCodeScene;
import com.nan.aisoftoj.auth.WeChatCodeExchangeClient;
import com.nan.aisoftoj.common.ForbiddenException;
import com.nan.aisoftoj.common.UnauthorizedException;
import com.nan.aisoftoj.common.UserRole;
import com.nan.aisoftoj.dto.AuthEmailCodeLoginRequest;
import com.nan.aisoftoj.dto.AuthLoginRequest;
import com.nan.aisoftoj.dto.AuthUserDTO;
import com.nan.aisoftoj.dto.AuthRegisterRequest;
import com.nan.aisoftoj.dto.PasswordResetRequest;
import com.nan.aisoftoj.dto.WeChatLoginRequest;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import com.nan.aisoftoj.service.AuthRateLimitService;
import com.nan.aisoftoj.service.EmailCodeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Date;

import cn.hutool.core.date.DateUtil;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    private static final String JWT_SECRET = "test-secret-that-is-long-enough-for-admin-authorization";

    @Mock
    private UserMapper userMapper;
    @Mock
    private PracticeSessionMapper practiceSessionMapper;
    @Mock
    private UserWrongQuestionStatMapper userWrongQuestionStatMapper;
    @Mock
    private EmailCodeService emailCodeService;
    @Mock
    private AuthRateLimitService rateLimitService;
    @Mock
    private WeChatCodeExchangeClient weChatCodeExchangeClient;
    @Mock
    private WeChatUserService weChatUserService;

    private AuthServiceImpl authService;

    @BeforeEach
    void setUp() {
        authService = new AuthServiceImpl();
        ReflectionTestUtils.setField(authService, "jwtSecret", JWT_SECRET);
        ReflectionTestUtils.setField(authService, "jwtExpireHours", 168L);
        ReflectionTestUtils.setField(authService, "userMapper", userMapper);
        ReflectionTestUtils.setField(authService, "practiceSessionMapper", practiceSessionMapper);
        ReflectionTestUtils.setField(authService, "userWrongQuestionStatMapper", userWrongQuestionStatMapper);
        ReflectionTestUtils.setField(authService, "emailCodeService", emailCodeService);
        ReflectionTestUtils.setField(authService, "rateLimitService", rateLimitService);
        ReflectionTestUtils.setField(authService, "weChatCodeExchangeClient", weChatCodeExchangeClient);
        ReflectionTestUtils.setField(authService, "weChatUserService", weChatUserService);
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

    @Test
    void registerUsesUsernameWhenNicknameIsOmitted() {
        AuthRegisterRequest request = new AuthRegisterRequest();
        request.setUsername("new-user");
        request.setEmail("new-user@example.com");
        request.setEmailCode("123456");
        request.setPassword("password");
        request.setConfirmPassword("password");

        when(userMapper.selectOne(any())).thenReturn(null);
        when(practiceSessionMapper.selectCount(any())).thenReturn(0L);
        when(userWrongQuestionStatMapper.selectCount(any())).thenReturn(0L);
        when(userMapper.updateLastLoginTime(any(Integer.class), any(Date.class))).thenReturn(1);
        doAnswer(invocation -> {
            User inserted = invocation.getArgument(0);
            inserted.setId(8);
            return 1;
        }).when(userMapper).insert(any(User.class));

        authService.register(request);

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        org.mockito.Mockito.verify(userMapper).insert(userCaptor.capture());
        User inserted = userCaptor.getValue();
        assertEquals("new-user", inserted.getLoginName());
        assertEquals("new-user", inserted.getNickName());
        assertEquals("new-user@example.com", inserted.getEmailNormalized());
        org.junit.jupiter.api.Assertions.assertNotNull(inserted.getEmailVerifiedAt());
        org.mockito.Mockito.verify(emailCodeService)
                .consumeCode("new-user@example.com", EmailCodeScene.REGISTER, "123456");
    }

    @Test
    void emailCodeLoginRequiresVerifiedActiveUserAndConsumesCode() {
        User user = activeUser(UserRole.USER.name());
        user.setEmailNormalized("user@example.com");
        user.setEmailVerifiedAt(new Date());
        when(userMapper.selectByNormalizedEmailForUpdate("user@example.com")).thenReturn(user);
        when(practiceSessionMapper.selectCount(any())).thenReturn(0L);
        when(userWrongQuestionStatMapper.selectCount(any())).thenReturn(0L);
        when(userMapper.updateLastLoginTime(any(Integer.class), any(Date.class))).thenReturn(1);

        AuthEmailCodeLoginRequest request = new AuthEmailCodeLoginRequest();
        request.setEmail("USER@example.com ");
        request.setCode("654321");

        authService.loginByEmailCode(request);

        org.mockito.Mockito.verify(emailCodeService)
                .consumeCode("user@example.com", EmailCodeScene.LOGIN, "654321");
        org.mockito.Mockito.verify(userMapper).updateLastLoginTime(eq(7), any(Date.class));
    }

    @Test
    void passwordLoginRecordsLastLoginTime() {
        User user = activeUser(UserRole.USER.name());
        user.setEmailNormalized("user@example.com");
        user.setEmailVerifiedAt(new Date());
        user.setPassword(cn.hutool.crypto.digest.BCrypt.hashpw("password"));
        when(userMapper.selectByNormalizedEmail("user@example.com")).thenReturn(user);
        when(practiceSessionMapper.selectCount(any())).thenReturn(0L);
        when(userWrongQuestionStatMapper.selectCount(any())).thenReturn(0L);
        when(userMapper.updateLastLoginTime(any(Integer.class), any(Date.class))).thenReturn(1);

        AuthLoginRequest request = new AuthLoginRequest();
        request.setEmail("USER@example.com ");
        request.setPassword("password");

        AuthUserDTO responseUser = authService.login(request, "127.0.0.1").getUser();

        org.junit.jupiter.api.Assertions.assertNotNull(user.getLastLoginTime());
        assertEquals(DateUtil.formatDateTime(user.getLastLoginTime()), responseUser.getLastLoginDate());
        org.mockito.Mockito.verify(userMapper).updateLastLoginTime(eq(7), any(Date.class));
    }

    @Test
    void authMeUsesPersistedLastLoginTime() {
        User user = activeUser(UserRole.USER.name());
        Date lastLoginTime = DateUtil.parseDateTime("2026-07-30 09:15:00");
        user.setCreateTime(DateUtil.parseDateTime("2026-07-01 08:00:00"));
        user.setLastLoginTime(lastLoginTime);
        when(userMapper.selectById(7)).thenReturn(user);
        when(practiceSessionMapper.selectCount(any())).thenReturn(0L);
        when(userWrongQuestionStatMapper.selectCount(any())).thenReturn(0L);

        AuthUserDTO currentUser = authService.getCurrentUser(tokenFor(7, System.currentTimeMillis() + 60_000));

        assertEquals(DateUtil.formatDateTime(lastLoginTime), currentUser.getLastLoginDate());
    }

    @Test
    void passwordResetChangesPasswordVersionAndInvalidatesOldToken() {
        User user = activeUser(UserRole.USER.name());
        user.setEmailNormalized("user@example.com");
        user.setEmailVerifiedAt(new Date());
        user.setPassword(cn.hutool.crypto.digest.BCrypt.hashpw("old-password"));
        user.setTokenVersion(0);
        when(userMapper.selectByNormalizedEmailForUpdate("user@example.com")).thenReturn(user);

        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("user@example.com");
        request.setCode("123456");
        request.setNewPassword("new-password");
        request.setConfirmPassword("new-password");

        authService.resetPassword(request);

        assertEquals(1, user.getTokenVersion());
        org.junit.jupiter.api.Assertions.assertTrue(
                cn.hutool.crypto.digest.BCrypt.checkpw("new-password", user.getPassword()));
        org.mockito.Mockito.verify(emailCodeService)
                .consumeCode("user@example.com", EmailCodeScene.PASSWORD_RESET, "123456");
        org.mockito.Mockito.verify(userMapper).updateById(user);

        when(userMapper.selectById(7)).thenReturn(user);
        assertThrows(UnauthorizedException.class,
                () -> authService.getCurrentUser(tokenFor(7, 0, System.currentTimeMillis() + 60_000)));
    }

    @Test
    void wechatLoginAppliesIpThenOpenIdLimitsBeforeIssuingToken() {
        User user = activeUser(UserRole.USER.name());
        when(weChatCodeExchangeClient.exchangeForOpenId("temporary-code"))
                .thenReturn("openid-1");
        when(weChatUserService.loginOrCreate("openid-1")).thenReturn(user);
        when(practiceSessionMapper.selectCount(any())).thenReturn(0L);
        when(userWrongQuestionStatMapper.selectCount(any())).thenReturn(0L);

        WeChatLoginRequest request = new WeChatLoginRequest();
        request.setCode("temporary-code");

        AuthUserDTO responseUser = authService.loginByWechat(request, "127.0.0.1").getUser();

        assertEquals("7", responseUser.getId());
        org.mockito.InOrder order = inOrder(
                rateLimitService, weChatCodeExchangeClient, weChatUserService);
        order.verify(rateLimitService).acquireWechatCodeExchangeLimit("127.0.0.1");
        order.verify(weChatCodeExchangeClient).exchangeForOpenId("temporary-code");
        order.verify(rateLimitService).acquireWechatOpenIdLoginLimit("openid-1");
        order.verify(weChatUserService).loginOrCreate("openid-1");
    }

    @Test
    void wxOnlyUserCanRequestEmailBindingCode() {
        User user = activeUser(UserRole.USER.name());
        user.setWxOpenId("openid-1");
        when(userMapper.selectById(7)).thenReturn(user);

        authService.sendEmailBindingCode(
                tokenFor(7, System.currentTimeMillis() + 60_000),
                " USER@example.com ",
                "127.0.0.1");

        org.mockito.Mockito.verify(emailCodeService)
                .requestBindingCode(" USER@example.com ", "127.0.0.1", 7);
    }

    @Test
    void emailBindingCodeRejectsNonWxOnlyAccounts() {
        User emailUser = activeUser(UserRole.USER.name());
        emailUser.setWxOpenId("openid-1");
        emailUser.setEmailNormalized("user@example.com");
        when(userMapper.selectById(7)).thenReturn(emailUser);
        assertThrows(IllegalArgumentException.class, () -> authService.sendEmailBindingCode(
                tokenFor(7, System.currentTimeMillis() + 60_000),
                "user@example.com",
                "127.0.0.1"));

        User admin = activeUser(UserRole.ADMIN.name());
        admin.setWxOpenId("openid-1");
        when(userMapper.selectById(7)).thenReturn(admin);
        assertThrows(IllegalArgumentException.class, () -> authService.sendEmailBindingCode(
                tokenFor(7, System.currentTimeMillis() + 60_000),
                "user@example.com",
                "127.0.0.1"));
    }

    private User activeUser(String role) {
        User user = new User();
        user.setId(7);
        user.setRole(role);
        user.setIsEnabled(true);
        user.setIsDeleted(false);
        user.setTokenVersion(0);
        return user;
    }

    private String tokenFor(Integer userId, long expiresAt) {
        return tokenFor(userId, null, expiresAt);
    }

    private String tokenFor(Integer userId, Integer tokenVersion, long expiresAt) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", userId);
        if (tokenVersion != null) {
            payload.put("tokenVersion", tokenVersion);
        }
        payload.put("exp", expiresAt);
        payload.put("iat", System.currentTimeMillis());
        return JWTUtil.createToken(payload, JWT_SECRET.getBytes(StandardCharsets.UTF_8));
    }
}
