package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("auth_rate_limit")
public class AuthRateLimit {
    @TableId(type = IdType.INPUT)
    private String limitKey;
    private Integer counter;
    private LocalDateTime windowStart;
    private LocalDateTime expiresAt;
    private LocalDateTime updateTime;
}
