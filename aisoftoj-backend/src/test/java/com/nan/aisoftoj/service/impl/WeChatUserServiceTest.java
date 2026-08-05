package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.common.UnauthorizedException;
import com.nan.aisoftoj.common.UserRole;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.mapper.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;

import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WeChatUserServiceTest {
    @Mock
    private UserMapper userMapper;

    private WeChatUserService service;

    @BeforeEach
    void setUp() {
        service = new WeChatUserService(userMapper);
    }

    @Test
    void reusesActiveUserAndRecordsLogin() {
        User user = activeUser(UserRole.USER.name());
        when(userMapper.selectByWxOpenIdForUpdate("openid-1")).thenReturn(user);
        when(userMapper.updateLastLoginTime(any(Integer.class), any(Date.class))).thenReturn(1);

        assertSame(user, service.loginOrCreate("openid-1"));
        verify(userMapper).updateLastLoginTime(any(Integer.class), any(Date.class));
    }

    @Test
    void rejectsAdminDisabledAndDeletedWechatUsers() {
        User admin = activeUser(UserRole.ADMIN.name());
        when(userMapper.selectByWxOpenIdForUpdate("admin")).thenReturn(admin);
        assertThrows(UnauthorizedException.class, () -> service.loginOrCreate("admin"));

        User disabled = activeUser(UserRole.USER.name());
        disabled.setIsEnabled(false);
        when(userMapper.selectByWxOpenIdForUpdate("disabled")).thenReturn(disabled);
        assertThrows(UnauthorizedException.class, () -> service.loginOrCreate("disabled"));

        User deleted = activeUser(UserRole.USER.name());
        deleted.setIsDeleted(true);
        when(userMapper.selectByWxOpenIdForUpdate("deleted")).thenReturn(deleted);
        assertThrows(UnauthorizedException.class, () -> service.loginOrCreate("deleted"));
    }

    @Test
    void createsMinimalWxOnlyUser() {
        when(userMapper.selectByWxOpenIdForUpdate("new-openid")).thenReturn(null);
        doAnswer(invocation -> {
            User inserted = invocation.getArgument(0);
            inserted.setId(9);
            return 1;
        }).when(userMapper).insert(any(User.class));
        when(userMapper.updateLastLoginTime(any(Integer.class), any(Date.class))).thenReturn(1);

        User created = service.loginOrCreate("new-openid");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).insert(captor.capture());
        User inserted = captor.getValue();
        assertEquals(UserRole.USER.name(), inserted.getRole());
        assertEquals("微信用户", inserted.getNickName());
        assertNull(inserted.getEmail());
        assertNull(inserted.getPassword());
        assertEquals(9, created.getId());
    }

    @Test
    void resolvesConcurrentFirstLoginByReadingUniqueKeyWinner() {
        User winner = activeUser(UserRole.USER.name());
        when(userMapper.selectByWxOpenIdForUpdate("racing-openid"))
                .thenReturn(null)
                .thenReturn(winner);
        doThrow(new DuplicateKeyException("uk_wx_open_id"))
                .when(userMapper).insert(any(User.class));
        when(userMapper.updateLastLoginTime(any(Integer.class), any(Date.class))).thenReturn(1);

        assertSame(winner, service.loginOrCreate("racing-openid"));
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
}
