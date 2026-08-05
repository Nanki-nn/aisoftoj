package com.nan.aisoftoj.service;

import com.nan.aisoftoj.auth.EmailCodeScene;

public interface AuthRateLimitService {
    void acquireEmailCodeLimits(String normalizedEmail, EmailCodeScene scene, String requestIp);

    void acquirePasswordLoginLimits(String normalizedEmail, String requestIp);

    void acquireWechatCodeExchangeLimit(String requestIp);

    void acquireWechatOpenIdLoginLimit(String openId);
}
