package com.nan.aisoftoj.common;

public class InvalidEmailCodeException extends IllegalArgumentException {
    public InvalidEmailCodeException() {
        super("邮箱验证码错误或已失效");
    }
}
