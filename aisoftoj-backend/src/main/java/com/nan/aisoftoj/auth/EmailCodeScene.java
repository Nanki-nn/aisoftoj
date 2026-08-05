package com.nan.aisoftoj.auth;

public enum EmailCodeScene {
    REGISTER("注册账号"),
    PASSWORD_RESET("重置密码"),
    LOGIN("登录账号"),
    BIND_EMAIL("绑定邮箱");

    private final String description;

    EmailCodeScene(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }

    public static EmailCodeScene from(String value) {
        try {
            return EmailCodeScene.valueOf(value);
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("不支持的邮箱验证码场景");
        }
    }
}
