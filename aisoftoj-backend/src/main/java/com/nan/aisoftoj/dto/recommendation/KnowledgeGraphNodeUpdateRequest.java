package com.nan.aisoftoj.dto.recommendation;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class KnowledgeGraphNodeUpdateRequest {
    @NotBlank(message = "知识点名称不能为空")
    @Size(max = 120, message = "知识点名称不能超过 120 个字符")
    private String label;
}
