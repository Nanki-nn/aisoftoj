package com.nan.aisoftoj.dto.admin;

import lombok.Data;

import java.util.Date;

@Data
public class AdminUserDTO {
    private Integer id;
    private String loginName;
    private String nickName;
    private String email;
    private String phone;
    private String avatar;
    private Boolean isEnabled;
    private Date createTime;
    private Date updateTime;
    private Long sessionCount;
    private Long wrongQuestionCount;
}
