package com.nan.aisoftoj.service;

import com.nan.aisoftoj.dto.ai.AiProfileDTO;
import com.nan.aisoftoj.dto.ai.AiPaperDTO;
import com.nan.aisoftoj.dto.ai.AiQuestionDTO;

import java.util.List;

public interface AiPlatformReadService {
    AiProfileDTO getProfile(Integer userId);

    List<AiPaperDTO> listPapers(Integer userId);

    AiQuestionDTO getQuestion(Integer questionId);
}
