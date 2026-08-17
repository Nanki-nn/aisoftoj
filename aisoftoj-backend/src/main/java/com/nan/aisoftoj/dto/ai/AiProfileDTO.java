package com.nan.aisoftoj.dto.ai;

import lombok.Data;

import java.time.Instant;

@Data
public class AiProfileDTO {
    private Integer userId;
    private String username;
    private String nickname;
    private String role;
    private Instant joinDate;
    private Instant lastLoginDate;
    private Long practiceSessionCount;
    private Long wrongQuestionCount;
}
