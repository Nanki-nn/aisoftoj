package com.nan.aisoftoj.service;

import com.nan.aisoftoj.entity.User;

public interface UserService {
    User register(User user);
    User login(String username, String password);
    User findById(Long id);
    User updateProfile(User user);
} 