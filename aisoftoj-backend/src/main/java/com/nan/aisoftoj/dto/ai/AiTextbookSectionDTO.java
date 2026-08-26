package com.nan.aisoftoj.dto.ai;

import lombok.Data;

@Data
public class AiTextbookSectionDTO {
    private Long id;
    private Long parentId;
    private Integer level;
    private String sectionCode;
    private String title;
    private Integer printedPageStart;
    private Integer printedPageEnd;
    private Integer pdfPageStart;
    private Integer pdfPageEnd;
    private Integer sortOrder;
}
