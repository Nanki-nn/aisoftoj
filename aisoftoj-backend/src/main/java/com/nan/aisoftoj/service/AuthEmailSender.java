package com.nan.aisoftoj.service;

import com.nan.aisoftoj.auth.EmailCodeScene;

public interface AuthEmailSender {
    void ensureConfigured();

    void sendCode(String email, EmailCodeScene scene, String code);
}
