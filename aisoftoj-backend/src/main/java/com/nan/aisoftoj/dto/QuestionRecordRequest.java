package com.nan.aisoftoj.dto;

import lombok.Getter;

public class

QuestionRecordRequest {
    // Getters and Setters
    @Getter
    private Long recordId;
    private Integer questionId;
    private String userAnswer;
    private Boolean isCorrect;
    private Integer spendTime;

    public void setRecordId(Long recordId) {
        this.recordId = recordId;
    }

    public Integer getQuestionId() {
        return questionId;
    }

    public void setQuestionId(Integer questionId) {
        this.questionId = questionId;
    }

    public String getUserAnswer() {
        return userAnswer;
    }

    public void setUserAnswer(String userAnswer) {
        this.userAnswer = userAnswer;
    }

    public Boolean getCorrect() {
        return isCorrect;
    }

    public void setCorrect(Boolean correct) {
        isCorrect = correct;
    }

    public Integer getSpendTime() {
        return spendTime;
    }

    public void setSpendTime(Integer spendTime) {
        this.spendTime = spendTime;
    }
}