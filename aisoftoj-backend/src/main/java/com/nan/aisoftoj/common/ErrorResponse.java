package com.nan.aisoftoj.common;

import lombok.Data;

@Data
public class ErrorResponse {
    private int code;
    private String message;
    private long timestamp;
    private String path;

    public ErrorResponse(int code, String message, String path) {
        this.code = code;
        this.message = message;
        this.timestamp = System.currentTimeMillis();
        this.path = path;
    }
}