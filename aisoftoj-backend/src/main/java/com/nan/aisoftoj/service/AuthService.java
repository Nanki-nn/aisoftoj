package com.nan.aisoftoj.service;

import com.nan.aisoftoj.dto.AuthLoginRequest;
import com.nan.aisoftoj.dto.AuthRegisterRequest;
import com.nan.aisoftoj.dto.AuthResponse;
import com.nan.aisoftoj.dto.AuthUserDTO;

public interface AuthService {
    AuthResponse login(AuthLoginRequest request);

    AuthResponse register(AuthRegisterRequest request);

    AuthUserDTO getCurrentUser(String token);

    void logout(String token);
}
