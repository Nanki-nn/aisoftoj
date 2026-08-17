package com.nan.aisoftoj.dto.ai;

import lombok.Data;

import java.time.Instant;

@Data
public class AiPracticeHistoryItemDTO {
    private Integer sessionId;
    private String paperName;
    private String examMode;
    private String examType;
    private Instant createdAt;
    private Integer answeredCount;
    private Integer questionCount;
    private String status;
}
