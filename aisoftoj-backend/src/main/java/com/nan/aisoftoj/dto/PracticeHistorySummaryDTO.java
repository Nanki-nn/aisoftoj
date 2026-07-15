package com.nan.aisoftoj.dto;

import lombok.Data;

@Data
public class PracticeHistorySummaryDTO {
    private Long totalCount;
    private Long inProgressCount;
    private Long completedCount;
    private Long answeredCount;
}
