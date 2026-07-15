package com.nan.aisoftoj.dto;

import lombok.Data;

@Data
public class WrongQuestionSummaryDTO {
    private Long totalCount;
    private Long masterCount;
    private Long frequentCount;
    private Long paperCount;
}
