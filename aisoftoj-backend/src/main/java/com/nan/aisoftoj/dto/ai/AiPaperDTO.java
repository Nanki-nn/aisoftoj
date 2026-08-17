package com.nan.aisoftoj.dto.ai;

import lombok.Data;

import java.time.Instant;

@Data
public class AiPaperDTO {
    private Integer paperId;
    private String name;
    private String subjectName;
    private String category;
    private Integer year;
    private Integer month;
    private Integer questionCount;
    private String practiceStatus;
    private Integer completedQuestionCount;
    private Integer ongoingSessionId;
    private Instant lastPracticeTime;
}
