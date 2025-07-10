package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class UserServiceImpl implements UserService {
    @Autowired
    private UserMapper userMapper;

    @Override
    public User register(User user) {
        // TODO: 注册逻辑
        return user;
    }

    @Override
    public User login(String username, String password) {
        // TODO: 登录逻辑
        return null;
    }

    @Override
    public User findById(Long id) {
        return userMapper.selectById(id);
    }

    @Override
    public User updateProfile(User user) {
        // TODO: 更新个人信息逻辑
        return user;
    }
} 