package com.nan.aisoftoj.dto.ai;

import lombok.Data;

@Data
public class AiAdminUserDTO {
    private Integer id;
    private String loginName;
    private String nickName;
    private String email;
    private String role;
    private Boolean isEnabled;
    private Boolean isDeleted;
}
