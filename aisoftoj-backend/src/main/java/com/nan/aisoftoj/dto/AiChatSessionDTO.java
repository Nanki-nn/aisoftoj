package com.nan.aisoftoj.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class AiChatSessionDTO {
    private Long id;
    private String title;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private List<AiChatMessageDTO> messages;
    private List<Long> knowledgeBaseIds;
}
