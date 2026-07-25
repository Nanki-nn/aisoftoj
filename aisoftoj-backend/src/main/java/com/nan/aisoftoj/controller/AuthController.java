package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.auth.EmailCodeScene;
import com.nan.aisoftoj.dto.AuthEmailCodeLoginRequest;
import com.nan.aisoftoj.dto.AuthLoginRequest;
import com.nan.aisoftoj.dto.AuthRegisterRequest;
import com.nan.aisoftoj.dto.AuthResponse;
import com.nan.aisoftoj.dto.AuthUserDTO;
import com.nan.aisoftoj.dto.EmailCodeRequest;
import com.nan.aisoftoj.dto.PasswordResetRequest;
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
    public ResultDTO<AuthResponse> login(
            @Validated @RequestBody AuthLoginRequest request,
            HttpServletRequest servletRequest) {
        return ResultDTO.success(authService.login(request, clientIp(servletRequest)));
    }

    @PostMapping("/register")
    public ResultDTO<AuthResponse> register(@Validated @RequestBody AuthRegisterRequest request) {
        return ResultDTO.success(authService.register(request));
    }

    @PostMapping("/email/code")
    public ResultDTO<Void> sendEmailCode(
            @Validated @RequestBody EmailCodeRequest request,
            HttpServletRequest servletRequest) {
        authService.sendEmailCode(
                request.getEmail(),
                EmailCodeScene.from(request.getScene()),
                clientIp(servletRequest));
        return ResultDTO.success("如果邮箱可用，验证码将发送到该邮箱", null);
    }

    @PostMapping("/email/login")
    public ResultDTO<AuthResponse> loginByEmailCode(
            @Validated @RequestBody AuthEmailCodeLoginRequest request) {
        return ResultDTO.success(authService.loginByEmailCode(request));
    }

    @PostMapping("/password/reset")
    public ResultDTO<Void> resetPassword(@Validated @RequestBody PasswordResetRequest request) {
        authService.resetPassword(request);
        return ResultDTO.success("密码已重置，请重新登录", null);
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

    private String clientIp(HttpServletRequest request) {
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.trim().isEmpty()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
