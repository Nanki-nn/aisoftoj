package com.nan.aisoftoj.dto.recommendation;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class KnowledgePointRecommendationDTO {
    private String id;
    private String name;
    private String subject;
    private String category;
    private Integer score;
    private Integer mastery;
    private Integer errorCount;
    private Integer wrongQuestionCount;
    private String level;
    private String reason;
    private String suggestion;
    private List<String> prerequisiteNames = new ArrayList<>();
    private List<String> relatedNames = new ArrayList<>();
    private List<WrongQuestionEvidenceDTO> evidences = new ArrayList<>();
}
