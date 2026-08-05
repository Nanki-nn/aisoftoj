package com.nan.aisoftoj.dto;

import lombok.Data;

import java.util.Date;

@Data
public class QuestionRecordUpdateResponse {
    private Integer recordId;
    private String userAnswer;
    private Integer spendTime;
    private Long answerRevision;
    private String mutationId;
    private Boolean isSubmitted;
    private Boolean isCorrect;
    private Date confirmedAt;
}
