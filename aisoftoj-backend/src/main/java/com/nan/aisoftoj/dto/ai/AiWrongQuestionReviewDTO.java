package com.nan.aisoftoj.dto.ai;

import lombok.Data;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
public class AiWrongQuestionReviewDTO {
    private Long wrongQuestionId;
    private Integer questionId;
    private Integer paperId;
    private String paperName;
    private String questionName;
    private String questionContent;
    private List<AiQuestionOptionDTO> options = new ArrayList<>();
    private String questionType;
    private String difficulty;
    private String userAnswer;
    private String correctAnswer;
    private String analysis;
    private Integer errorCount;
    private String importance;
    private Instant lastWrongTime;
    private Integer spendTime;
}
