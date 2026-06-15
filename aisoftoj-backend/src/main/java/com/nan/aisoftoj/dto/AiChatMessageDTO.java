package com.nan.aisoftoj.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
public class AiChatMessageDTO {
    private Long id;
    private String role;
    private String content;
    private Boolean webEnabled;
    private Boolean thinkingEnabled;
    private String reasoningContent;
    private String status;
    private List<Map<String, Object>> citations;
    private String errorMessage;
    private LocalDateTime createTime;
}
