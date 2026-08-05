package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.common.UnauthorizedException;
import com.nan.aisoftoj.common.UserRole;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.mapper.UserMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;

@Service
public class WeChatUserService {
    private final UserMapper userMapper;

    public WeChatUserService(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @Transactional(rollbackFor = Exception.class)
    public User loginOrCreate(String openId) {
        User user = userMapper.selectByWxOpenIdForUpdate(openId);
        if (user == null) {
            user = createWechatUser(openId);
        }
        requireActiveRegularUser(user);
        markLogin(user);
        return user;
    }

    private User createWechatUser(String openId) {
        User user = new User();
        user.setWxOpenId(openId);
        user.setNickName("微信用户");
        user.setTokenVersion(0);
        user.setRole(UserRole.USER.name());
        user.setIsEnabled(true);
        user.setIsDeleted(false);
        try {
            userMapper.insert(user);
            return user;
        } catch (DuplicateKeyException ex) {
            User winner = userMapper.selectByWxOpenIdForUpdate(openId);
            if (winner == null) {
                throw ex;
            }
            return winner;
        }
    }

    private void requireActiveRegularUser(User user) {
        if (user == null
                || Boolean.TRUE.equals(user.getIsDeleted())
                || !Boolean.TRUE.equals(user.getIsEnabled())
                || !UserRole.USER.name().equals(user.getRole())) {
            throw new UnauthorizedException("微信登录失败，请重试");
        }
    }

    private void markLogin(User user) {
        Date loginTime = new Date();
        if (userMapper.updateLastLoginTime(user.getId(), loginTime) != 1) {
            throw new IllegalStateException("记录登录时间失败");
        }
        user.setLastLoginTime(loginTime);
    }
}
