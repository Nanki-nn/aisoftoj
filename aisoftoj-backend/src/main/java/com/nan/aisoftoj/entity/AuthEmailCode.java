package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("auth_email_code")
public class AuthEmailCode {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String email;
    private String scene;
    private String codeHash;
    private String codeSalt;
    private String status;
    private LocalDateTime expiresAt;
    private LocalDateTime activatedAt;
    private LocalDateTime consumedAt;
    private Integer failedAttempts;
    private String requestIp;
    private LocalDateTime createTime;
}
