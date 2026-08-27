package com.nan.aisoftoj.dto.ai;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class AiQuestionDTO {
    private Integer questionId;
    private String name;
    private String content;
    private List<AiQuestionOptionDTO> options = new ArrayList<>();
    private String questionType;
    private String difficulty;
    private String correctAnswer;
    private String analysis;
}
