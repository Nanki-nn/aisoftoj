package com.nan.aisoftoj.dto.recommendation;

import lombok.Data;

import java.util.Date;

@Data
public class WrongQuestionEvidenceDTO {
    private Integer questionId;
    private String questionName;
    private String knowledgePointName;
    private String subjectName;
    private String paperName;
    private String questionType;
    private String questionIntro;
    private String options;
    private String analysis;
    private Integer difficulty;
    private Integer paperYear;
    private Integer errorCount;
    private String importanceLevel;
    private Date lastWrongTime;
}
