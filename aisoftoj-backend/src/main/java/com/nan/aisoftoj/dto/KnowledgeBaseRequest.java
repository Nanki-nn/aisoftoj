package com.nan.aisoftoj.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class KnowledgeBaseRequest {
    @NotBlank
    @Size(max = 64)
    private String name;
    @Size(max = 500)
    private String description;
    @Size(max = 32)
    private String color;
}
