package com.nan.aisoftoj.dto.ai;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class AiTextbookCatalogDTO {
    private Long textbookId;
    private String subjectName;
    private String name;
    private String edition;
    private String isbn;
    private String officialUrl;
    private String viewerPageTemplate;
    private List<AiTextbookSectionDTO> sections = new ArrayList<>();
    private List<AiKnowledgePointDTO> knowledgePoints = new ArrayList<>();
}
