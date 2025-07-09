package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user")
public class UserController {
    @Autowired
    private UserService userService;

    @PostMapping("/register")
    public User register(@RequestBody User user) {
        return userService.register(user);
    }

    @PostMapping("/login")
    public User login(@RequestBody User user) {
        return userService.login(user.getUsername(), user.getPassword());
    }

    @GetMapping("/{id}")
    public User getProfile(@PathVariable Long id) {
        return userService.findById(id);
    }

    @PostMapping("/profile/update")
    public User updateProfile(@RequestBody User user) {
        return userService.updateProfile(user);
    }

    // 收藏、错题、刷题记录接口可根据需要补充
} 