package com.nan.aisoftoj.dto.recommendation;

import lombok.Data;

@Data
public class StudyRoadmapRequest {
    private Integer days;
    private String subjectName;
    private Integer dailyMinutes;
}
