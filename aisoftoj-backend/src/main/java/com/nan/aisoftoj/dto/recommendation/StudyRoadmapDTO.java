package com.nan.aisoftoj.dto.recommendation;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class StudyRoadmapDTO {
    private Integer days;
    private Integer dailyMinutes;
    private String summary;
    private boolean aiEnhanced;
    private List<StudyDayDTO> items = new ArrayList<>();

    @Data
    public static class StudyDayDTO {
        private Integer day;
        private String title;
        private String goal;
        private List<String> knowledgePoints = new ArrayList<>();
        private List<String> tasks = new ArrayList<>();
        private List<String> reviewQuestions = new ArrayList<>();
        private String practiceTarget;
        private String checkpoint;
    }
}
