package com.nan.aisoftoj.dto.ai;

import lombok.Data;

@Data
public class AiPracticeHistorySummaryDTO {
    private Long totalCount;
    private Long inProgressCount;
    private Long completedCount;
    private Long answeredCount;
}
