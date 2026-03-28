package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.AuthLoginRequest;
import com.nan.aisoftoj.dto.AuthRegisterRequest;
import com.nan.aisoftoj.dto.AuthResponse;
import com.nan.aisoftoj.dto.AuthUserDTO;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/login")
    public ResultDTO<AuthResponse> login(@Validated @RequestBody AuthLoginRequest request) {
        return ResultDTO.success(authService.login(request));
    }

    @PostMapping("/register")
    public ResultDTO<AuthResponse> register(@Validated @RequestBody AuthRegisterRequest request) {
        return ResultDTO.success(authService.register(request));
    }

    @GetMapping("/me")
    public ResultDTO<AuthUserDTO> me(HttpServletRequest request) {
        return ResultDTO.success(authService.getCurrentUser(request.getHeader("Authorization")));
    }

    @PostMapping("/logout")
    public ResultDTO<Void> logout(HttpServletRequest request) {
        authService.logout(request.getHeader("Authorization"));
        return ResultDTO.success();
    }
}
