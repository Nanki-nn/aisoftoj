package com.nan.aisoftoj.dto;

import lombok.Data;

@Data
public class AuthResponse {
    private String token;
    private AuthUserDTO user;
}
