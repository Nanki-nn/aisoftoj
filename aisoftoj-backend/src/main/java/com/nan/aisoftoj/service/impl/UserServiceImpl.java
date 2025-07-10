package com.nan.aisoftoj.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
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
        // 检查用户名是否已存在
        LambdaQueryWrapper<User> wrapper = Wrappers.lambdaQuery();
        wrapper.eq(User::getUsername, user.getUsername());
        User exist = userMapper.selectOne(wrapper);
        
        if (exist != null) {
            throw new RuntimeException("用户名已存在");
        }
        
        // 设置默认角色为普通用户
        if (user.getRole() == null) {
            user.setRole(0);
        }
        
        // 密码加密（演示用，实际项目请用加密算法）
        // user.setPassword(BCrypt.hashpw(user.getPassword(), BCrypt.gensalt()));
        
        userMapper.insert(user);
        return user;
    }

    @Override
    public User login(String username, String password) {
        LambdaQueryWrapper<User> wrapper = Wrappers.lambdaQuery();
        wrapper.eq(User::getUsername, username);
        User user = userMapper.selectOne(wrapper);
        
        if (user == null) {
            throw new RuntimeException("用户不存在");
        }
        
        // 密码校验（演示用，实际项目请用加密算法）
        if (!user.getPassword().equals(password)) {
            throw new RuntimeException("密码错误");
        }
        
        return user;
    }

    @Override
    public User findById(Long id) {
        return userMapper.selectById(id);
    }

    @Override
    public User updateProfile(User user) {
        userMapper.updateById(user);
        return userMapper.selectById(user.getId());
    }
} 