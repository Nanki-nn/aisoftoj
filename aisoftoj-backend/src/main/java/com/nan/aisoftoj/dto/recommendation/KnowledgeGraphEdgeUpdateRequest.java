package com.nan.aisoftoj.dto.recommendation;

import lombok.Data;

import javax.validation.constraints.DecimalMax;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class KnowledgeGraphEdgeUpdateRequest {
    @NotBlank(message = "关系类型不能为空")
    private String type;

    @Size(max = 40, message = "关系标签不能超过 40 个字符")
    private String label;

    @DecimalMin(value = "0.05", message = "关系权重不能小于 0.05")
    @DecimalMax(value = "1.0", message = "关系权重不能大于 1.0")
    private Double weight;
}
