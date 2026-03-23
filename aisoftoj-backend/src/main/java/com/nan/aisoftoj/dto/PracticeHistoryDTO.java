package com.nan.aisoftoj.dto;

import lombok.Data;

@Data
public class PracticeHistoryDTO {
    private Long id;
    private Integer sessionId;
    private String examName;
    private String examMode;
    private String examType;
    private String createTime;
    private Integer answeredCount;
    private Integer totalCount;
    private String status;
}
