package com.nan.aisoftoj.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class WeChatLoginRequest {
    @NotBlank(message = "微信登录凭证不能为空")
    @Size(max = 256, message = "微信登录凭证长度不能超过256位")
    private String code;
}
