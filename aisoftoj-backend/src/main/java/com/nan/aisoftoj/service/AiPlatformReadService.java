package com.nan.aisoftoj.service;

import com.nan.aisoftoj.dto.ai.AiProfileDTO;

public interface AiPlatformReadService {
    AiProfileDTO getProfile(Integer userId);
}
