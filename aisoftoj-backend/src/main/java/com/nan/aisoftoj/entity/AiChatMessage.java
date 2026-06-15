package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("ai_chat_message")
public class AiChatMessage {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long sessionId;
    private String role;
    private String content;
    private Boolean webEnabled;
    private Boolean thinkingEnabled;
    private String reasoningContent;
    private String status;
    private String citations;
    private String errorMessage;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
