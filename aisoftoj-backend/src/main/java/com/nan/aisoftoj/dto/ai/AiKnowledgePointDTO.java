package com.nan.aisoftoj.dto.ai;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class AiKnowledgePointDTO {
    private Long id;
    private Long parentId;
    private Integer level;
    private String code;
    private String name;
    private String description;
    private List<AiKnowledgePointSourceDTO> sources = new ArrayList<>();
}
