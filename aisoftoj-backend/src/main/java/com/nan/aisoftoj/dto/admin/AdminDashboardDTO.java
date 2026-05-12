package com.nan.aisoftoj.dto.admin;

import lombok.Data;

@Data
public class AdminDashboardDTO {
    private Long userTotal;
    private Long enabledUserTotal;
    private Long questionTotal;
    private Long activeQuestionTotal;
}
