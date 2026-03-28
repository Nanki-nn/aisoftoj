package com.nan.aisoftoj.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class AuthLoginRequest {
    @NotBlank(message = "邮箱不能为空")
    private String email;

    @NotBlank(message = "密码不能为空")
    private String password;
}
