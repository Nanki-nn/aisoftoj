package com.nan.aisoftoj.service;

import com.nan.aisoftoj.dto.ai.AiProfileDTO;
import com.nan.aisoftoj.dto.ai.AiPaperDTO;
import com.nan.aisoftoj.dto.ai.AiQuestionDTO;
import com.nan.aisoftoj.dto.ai.AiPracticeHistoryPageDTO;
import com.nan.aisoftoj.dto.ai.AiWrongQuestionReviewDTO;
import com.nan.aisoftoj.dto.ai.AiAdminUserBatchDTO;

import java.util.List;

public interface AiPlatformReadService {
    AiProfileDTO getProfile(Integer userId);

    List<AiPaperDTO> listPapers(Integer userId);

    AiQuestionDTO getQuestion(Integer questionId);

    boolean isAiAssistantAvailable(Integer userId);

    AiWrongQuestionReviewDTO reviewWrongQuestion(Integer userId, Long wrongQuestionId);

    AiPracticeHistoryPageDTO listPracticeHistory(Integer userId, Integer page, Integer pageSize);

    AiAdminUserBatchDTO listAdminUsers(List<Integer> userIds);
}
