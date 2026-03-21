package com.nan.aisoftoj.dto;

import java.util.Date;
import java.util.List;

public class PaperSubmitRequest {
    private Integer userId;
    private Integer paperId;
    private Date startTime;
    private Date endTime;
    private List<QuestionAnswer> answers;

    // Getters and Setters
    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    public Integer getPaperId() {
        return paperId;
    }

    public void setPaperId(Integer paperId) {
        this.paperId = paperId;
    }

    public Date getStartTime() {
        return startTime;
    }

    public void setStartTime(Date startTime) {
        this.startTime = startTime;
    }

    public Date getEndTime() {
        return endTime;
    }

    public void setEndTime(Date endTime) {
        this.endTime = endTime;
    }

    public List<QuestionAnswer> getAnswers() {
        return answers;
    }

    public void setAnswers(List<QuestionAnswer> answers) {
        this.answers = answers;
    }

    public static class QuestionAnswer {
        private Integer questionId;
        private String userAnswer;
        private Integer spendTime;

        // Getters and Setters
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

        public Integer getSpendTime() {
            return spendTime;
        }

        public void setSpendTime(Integer spendTime) {
            this.spendTime = spendTime;
        }
    }
}