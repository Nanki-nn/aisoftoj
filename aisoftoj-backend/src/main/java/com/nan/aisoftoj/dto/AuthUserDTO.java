package com.nan.aisoftoj.dto;

import lombok.Data;

@Data
public class AuthUserDTO {
    private String id;
    private String username;
    private String email;
    private String nickname;
    private String avatar;
    private String phone;
    private String joinDate;
    private String lastLoginDate;
    private Integer totalExams;
    private Integer totalQuestions;
    private Integer correctAnswers;
    private Integer accuracy;
    private Integer studyDays;
    private String level;
    private Integer points;
    private String[] badges;
}
