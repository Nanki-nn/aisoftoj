package com.nan.aisoftoj.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
public class SessionQuestionSnapshot {
    private Integer paperQuestionRelationId;
    private Integer questionId;
    private Integer questionOrder;
    private BigDecimal scoreSnapshot;
    private String gradingStrategySnapshot;
    private String name;
    private String intro;
    private String options;
    private String answer;
    private String analysis;
    private Integer questionType;
    private Integer difficulty;
    private Integer questionRecordId;
    private String userAnswer;
    private Boolean isSubmitted;
    private Boolean isCorrect;
    private Integer spendTime;
    private Long answerRevision;
    private Date confirmedAt;
}
