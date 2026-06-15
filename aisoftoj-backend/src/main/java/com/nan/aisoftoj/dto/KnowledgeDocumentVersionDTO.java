package com.nan.aisoftoj.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
public class KnowledgeDocumentVersionDTO {
    private Long id;
    private Integer version;
    private String status;
    private Integer progress;
    private Integer queuedAhead;
    private Integer chunkCount;
    private String errorMessage;
    private String mineruTaskId;
    private String traceId;
    private String failureType;
    private Long stageDurationMs;
    private Long totalDurationMs;
    private Map<String, Object> options;
    private LocalDateTime startedTime;
    private LocalDateTime completedTime;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
