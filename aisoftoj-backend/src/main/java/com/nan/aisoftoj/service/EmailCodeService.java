package com.nan.aisoftoj.service;

import com.nan.aisoftoj.auth.EmailCodeScene;

public interface EmailCodeService {
    void requestCode(String email, EmailCodeScene scene, String requestIp);

    void consumeCode(String normalizedEmail, EmailCodeScene scene, String code);
}
