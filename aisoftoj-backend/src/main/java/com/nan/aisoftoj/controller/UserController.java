package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

/**
 * 用户相关接口
 */
@RestController
@RequestMapping("/api/user")
public class UserController {
    @Autowired
    private UserService userService;

    /**
     * 用户注册
     */
    @PostMapping("/register")
    public User register(@RequestBody User user) {
        return userService.register(user);
    }

    /**
     * 用户登录
     */
    @PostMapping("/login")
    public User login(@RequestBody User user) {
        return userService.login(user.getUsername(), user.getPassword());
    }

    /**
     * 获取用户个人信息
     */
    @GetMapping("/{id}")
    public User getProfile(@PathVariable Long id) {
        return userService.findById(id);
    }

    /**
     * 更新用户个人信息
     */
    @PostMapping("/profile/update")
    public User updateProfile(@RequestBody User user) {
        return userService.updateProfile(user);
    }
} 