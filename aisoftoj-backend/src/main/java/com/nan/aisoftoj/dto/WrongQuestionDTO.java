package com.nan.aisoftoj.dto;

import lombok.Data;

@Data
public class WrongQuestionDTO {
    private Long id;
    private String topicName;
    private String questionBank;
    private String topicType;
    private Integer errorCount;
    private String updateTime;
    private String importance;
}
