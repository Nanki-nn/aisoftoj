package com.nan.aisoftoj.service;

import com.nan.aisoftoj.auth.EmailCodeScene;
import com.nan.aisoftoj.dto.AuthEmailCodeLoginRequest;
import com.nan.aisoftoj.dto.AuthLoginRequest;
import com.nan.aisoftoj.dto.AuthRegisterRequest;
import com.nan.aisoftoj.dto.AuthResponse;
import com.nan.aisoftoj.dto.AuthUserDTO;
import com.nan.aisoftoj.dto.PasswordResetRequest;

public interface AuthService {
    AuthResponse login(AuthLoginRequest request, String requestIp);

    AuthResponse register(AuthRegisterRequest request);

    void sendEmailCode(String email, EmailCodeScene scene, String requestIp);

    AuthResponse loginByEmailCode(AuthEmailCodeLoginRequest request);

    void resetPassword(PasswordResetRequest request);

    AuthUserDTO getCurrentUser(String token);

    Integer getCurrentUserId(String token);

    Integer requireAdmin(String token);

    void logout(String token);
}
