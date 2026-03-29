package com.nan.aisoftoj.service;

import com.nan.aisoftoj.dto.EssayHistoryItem;
import com.nan.aisoftoj.dto.EssayResultResponse;
import com.nan.aisoftoj.dto.EssaySubmitRequest;
import com.nan.aisoftoj.dto.ResultDTO;

import java.util.List;
import java.util.Map;

public interface EssayService {

    /**
     * 提交论文批改请求
     */
    ResultDTO<?> submitEssay(EssaySubmitRequest req, Long userId);

    /**
     * 获取批改结果
     */
    ResultDTO<EssayResultResponse> getResult(Long submissionId, Long userId);

    /**
     * 获取历史提交记录
     */
    ResultDTO<List<EssayHistoryItem>> getHistory(Long userId);

    /**
     * 获取论文题目列表
     */
    ResultDTO<List<Map<String, Object>>> getQuestions(String subject);

    /**
     * 异步批改（在 Issue #4 中实现）
     */
    void gradeAsync(Long submissionId);
}
