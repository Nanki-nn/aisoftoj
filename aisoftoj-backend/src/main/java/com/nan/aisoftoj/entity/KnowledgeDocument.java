package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("knowledge_document")
public class KnowledgeDocument {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private Long knowledgeBaseRefId;
    private String knowledgeBaseId;
    private String documentId;
    private String fileName;
    private String fileType;
    private Long fileSize;
    private String storagePath;
    private String jobId;
    private String status;
    private Integer chunkCount;
    private Integer version;
    private String errorMessage;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    @TableLogic
    private Integer isDeleted;
}
