package com.nan.aisoftoj.dto;

import java.util.List;
import lombok.Data;

/**
 * 题目详情
 */
@Data
public class GetQuestionDetailDTO {

    private Integer id;

    private String name;

    private String intro;

    private String answer;

    private String analysis;

    private List<Option> options;

    private Integer questionType;

    private Integer difficulty;

    private Integer readCt;

}

