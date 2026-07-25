package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("auth_email_outbox")
public class AuthEmailOutbox {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long codeId;
    private String email;
    private String scene;
    private String payloadCiphertext;
    private String payloadIv;
    private String status;
    private Integer attemptCount;
    private LocalDateTime nextAttemptAt;
    private LocalDateTime lockedAt;
    private String lastError;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
