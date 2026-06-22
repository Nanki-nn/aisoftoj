package com.nan.aisoftoj.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
public class KnowledgeDocumentDTO {
    private Long id;
    private String documentId;
    private Long knowledgeBaseId;
    private String knowledgeBaseName;
    private String fileName;
    private String fileType;
    private Long fileSize;
    private String status;
    private Integer chunkCount;
    private String errorMessage;
    private Integer version;
    private Integer progress;
    private Integer queuedAhead;
    private String graphStatus;
    private Integer graphNodeCount;
    private Integer graphRelationCount;
    private Integer graphPendingCount;
    private String graphErrorMessage;
    private String graphUpdatedAt;
    private Map<String, Object> options;
    private List<KnowledgeDocumentVersionDTO> versions;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
