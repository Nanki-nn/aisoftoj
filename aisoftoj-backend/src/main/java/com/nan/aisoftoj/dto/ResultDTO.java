package com.nan.aisoftoj.dto;

import java.io.Serializable;

/**
 * 统一返回结果DTO
 */
public class ResultDTO<T> implements Serializable {
    
    private static final long serialVersionUID = 1L;
    
    /**
     * 状态码
     */
    private Integer code;
    
    /**
     * 消息
     */
    private String message;
    
    /**
     * 数据
     */
    private T data;
    
    /**
     * 时间戳
     */
    private Long timestamp;
    
    public ResultDTO() {
        this.timestamp = System.currentTimeMillis();
    }
    
    public ResultDTO(Integer code, String message) {
        this();
        this.code = code;
        this.message = message;
    }
    
    public ResultDTO(Integer code, String message, T data) {
        this();
        this.code = code;
        this.message = message;
        this.data = data;
    }
    
    /**
     * 成功返回
     */
    public static <T> ResultDTO<T> success() {
        return new ResultDTO<>(200, "操作成功");
    }
    
    /**
     * 成功返回带数据
     */
    public static <T> ResultDTO<T> success(T data) {
        return new ResultDTO<>(200, "操作成功", data);
    }
    
    /**
     * 成功返回带消息和数据
     */
    public static <T> ResultDTO<T> success(String message, T data) {
        return new ResultDTO<>(200, message, data);
    }
    
    /**
     * 失败返回
     */
    public static <T> ResultDTO<T> error() {
        return new ResultDTO<>(500, "操作失败");
    }
    
    /**
     * 失败返回带消息
     */
    public static <T> ResultDTO<T> error(String message) {
        return new ResultDTO<>(500, message);
    }
    
    /**
     * 失败返回带状态码和消息
     */
    public static <T> ResultDTO<T> error(Integer code, String message) {
        return new ResultDTO<>(code, message);
    }
    
    /**
     * 失败返回带状态码、消息和数据
     */
    public static <T> ResultDTO<T> error(Integer code, String message, T data) {
        return new ResultDTO<>(code, message, data);
    }
    
    /**
     * 参数错误
     */
    public static <T> ResultDTO<T> badRequest(String message) {
        return new ResultDTO<>(400, message);
    }
    
    /**
     * 未找到资源
     */
    public static <T> ResultDTO<T> notFound(String message) {
        return new ResultDTO<>(404, message);
    }
    
    /**
     * 未授权
     */
    public static <T> ResultDTO<T> unauthorized(String message) {
        return new ResultDTO<>(401, message);
    }
    
    /**
     * 禁止访问
     */
    public static <T> ResultDTO<T> forbidden(String message) {
        return new ResultDTO<>(403, message);
    }
    
    // Getter and Setter
    public Integer getCode() {
        return code;
    }
    
    public void setCode(Integer code) {
        this.code = code;
    }
    
    public String getMessage() {
        return message;
    }
    
    public void setMessage(String message) {
        this.message = message;
    }
    
    public T getData() {
        return data;
    }
    
    public void setData(T data) {
        this.data = data;
    }
    
    public Long getTimestamp() {
        return timestamp;
    }
    
    public void setTimestamp(Long timestamp) {
        this.timestamp = timestamp;
    }
    
    @Override
    public String toString() {
        return "ResultDTO{" +
                "code=" + code +
                ", message='" + message + '\'' +
                ", data=" + data +
                ", timestamp=" + timestamp +
                '}';
    }
} 