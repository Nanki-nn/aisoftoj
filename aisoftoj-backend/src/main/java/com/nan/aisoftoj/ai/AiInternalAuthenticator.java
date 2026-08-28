package com.nan.aisoftoj.ai;

import cn.hutool.core.util.StrUtil;
import com.nan.aisoftoj.common.ForbiddenException;
import com.nan.aisoftoj.service.AuthService;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Component
public class AiInternalAuthenticator {

    private final AiInternalProperties properties;
    private final AuthService authService;

    public AiInternalAuthenticator(AiInternalProperties properties, AuthService authService) {
        this.properties = properties;
        this.authService = authService;
    }

    public Integer authenticate(String serviceKey, String authorization) {
        String configuredKey = properties.getServiceKey();
        if (StrUtil.isBlank(configuredKey)
                || StrUtil.isBlank(serviceKey)
                || !MessageDigest.isEqual(
                        configuredKey.getBytes(StandardCharsets.UTF_8),
                        serviceKey.getBytes(StandardCharsets.UTF_8))) {
            throw new ForbiddenException("AI 服务认证失败");
        }
        return authService.getCurrentUserId(authorization);
    }

    public Integer authenticateAdmin(String serviceKey, String authorization) {
        authenticate(serviceKey, authorization);
        return authService.requireAdmin(authorization);
    }
}
