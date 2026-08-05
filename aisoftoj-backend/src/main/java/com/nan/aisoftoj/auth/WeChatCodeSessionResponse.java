package com.nan.aisoftoj.auth;

import com.fasterxml.jackson.annotation.JsonProperty;

public class WeChatCodeSessionResponse {
    @JsonProperty("openid")
    private String openId;
    @JsonProperty("errcode")
    private Integer errorCode;

    public String getOpenId() {
        return openId;
    }

    public void setOpenId(String openId) {
        this.openId = openId;
    }

    public Integer getErrorCode() {
        return errorCode;
    }

    public void setErrorCode(Integer errorCode) {
        this.errorCode = errorCode;
    }

}
