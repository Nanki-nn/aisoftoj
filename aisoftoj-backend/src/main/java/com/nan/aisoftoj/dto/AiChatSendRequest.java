package com.nan.aisoftoj.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class AiChatSendRequest {
    @NotBlank(message = "问题不能为空")
    @Size(max = 4000, message = "问题不能超过 4000 个字符")
    private String question;
    private Boolean webEnabled = false;
    private Boolean thinkingEnabled = false;
    private Integer rewriteCount = 3;
}
