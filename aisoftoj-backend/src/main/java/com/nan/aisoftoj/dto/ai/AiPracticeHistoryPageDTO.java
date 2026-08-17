package com.nan.aisoftoj.dto.ai;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class AiPracticeHistoryPageDTO {
    private List<AiPracticeHistoryItemDTO> records = new ArrayList<>();
    private Long total;
    private Integer page;
    private Integer pageSize;
    private AiPracticeHistorySummaryDTO summary;
}
