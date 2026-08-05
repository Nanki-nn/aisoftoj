package com.nan.aisoftoj.auth;

import cn.hutool.core.util.StrUtil;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "auth.wechat")
public class WeChatProperties {
    private String appId;
    private String appSecret;
    private String codeSessionUrl = "https://api.weixin.qq.com/sns/jscode2session";
    private int connectTimeoutMs = 3000;
    private int readTimeoutMs = 5000;

    public void ensureConfigured() {
        if (StrUtil.isBlank(appId) || StrUtil.isBlank(appSecret)) {
            throw new IllegalStateException("微信登录未配置");
        }
    }

    public String getAppId() {
        return appId;
    }

    public void setAppId(String appId) {
        this.appId = appId;
    }

    public String getAppSecret() {
        return appSecret;
    }

    public void setAppSecret(String appSecret) {
        this.appSecret = appSecret;
    }

    public String getCodeSessionUrl() {
        return codeSessionUrl;
    }

    public void setCodeSessionUrl(String codeSessionUrl) {
        this.codeSessionUrl = codeSessionUrl;
    }

    public int getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    public void setConnectTimeoutMs(int connectTimeoutMs) {
        this.connectTimeoutMs = connectTimeoutMs;
    }

    public int getReadTimeoutMs() {
        return readTimeoutMs;
    }

    public void setReadTimeoutMs(int readTimeoutMs) {
        this.readTimeoutMs = readTimeoutMs;
    }
}
