package com.nan.aisoftoj.dto.ai;

import lombok.Data;

@Data
public class AiKnowledgePointSourceDTO {
    private Long id;
    private Long sectionId;
    private Integer printedPageStart;
    private Integer printedPageEnd;
    private Integer pdfPageStart;
    private Integer pdfPageEnd;
    private Boolean primary;
}
