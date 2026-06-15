package com.nan.aisoftoj.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class KnowledgeBaseDTO {
    private Long id;
    private String name;
    private String description;
    private String color;
    private Boolean isDefault;
    private Integer documentCount;
    private Integer readyCount;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
