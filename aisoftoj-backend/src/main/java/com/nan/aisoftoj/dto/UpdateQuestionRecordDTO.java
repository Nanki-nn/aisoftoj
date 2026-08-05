package com.nan.aisoftoj.dto;

import lombok.Data;

import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

@Data
public class UpdateQuestionRecordDTO {

    private String userAnswer;

    @Min(value = 0, message = "答题耗时不能为负数")
    private Integer spendTime;

    @NotNull(message = "答案版本不能为空")
    @Min(value = 0, message = "答案版本不能为负数")
    private Long expectedRevision;

    @NotBlank(message = "变更标识不能为空")
    @Size(max = 64, message = "变更标识不能超过64个字符")
    private String mutationId;

    private Boolean confirm = false;
}
