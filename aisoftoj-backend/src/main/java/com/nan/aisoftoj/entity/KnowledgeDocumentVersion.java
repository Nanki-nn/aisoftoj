package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("knowledge_document_version")
public class KnowledgeDocumentVersion {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long documentId;
    private Integer version;
    private String aiJobId;
    private String mineruTaskId;
    private String status;
    private Integer progress;
    private Integer queuedAhead;
    private Integer chunkCount;
    private String optionsJson;
    private String errorMessage;
    private String markdownPath;
    private String contentListPath;
    private String rawResultPath;
    private String chunksPath;
    private String traceId;
    private String failureType;
    private Long stageDurationMs;
    private Long totalDurationMs;
    private LocalDateTime startedTime;
    private LocalDateTime completedTime;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
