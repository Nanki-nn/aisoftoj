package com.nan.aisoftoj.dto.admin;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class AdminQuestionRequest {
    @NotBlank(message = "题目名称不能为空")
    private String name;

    private String intro;

    private String options;

    @NotBlank(message = "标准答案不能为空")
    private String answer;

    private String analysis;

    @NotNull(message = "题型不能为空")
    private Integer questionType;

    @NotNull(message = "难度不能为空")
    private Integer difficulty;
}
