package com.nan.aisoftoj.dto.admin;

import lombok.Data;

@Data
public class AdminUserUpdateRequest {
    private String loginName;
    private String nickName;
    private String email;
    private String phone;
    private Boolean isEnabled;
}
