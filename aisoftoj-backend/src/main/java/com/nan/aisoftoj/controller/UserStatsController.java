package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.PageWithSummaryDTO;
import com.nan.aisoftoj.dto.PracticeHistoryDTO;
import com.nan.aisoftoj.dto.PracticeHistorySummaryDTO;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.dto.WrongQuestionDTO;
import com.nan.aisoftoj.dto.WrongQuestionSummaryDTO;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import com.nan.aisoftoj.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

@RestController
public class UserStatsController {

    @Autowired
    private PracticeSessionMapper practiceSessionMapper;

    @Autowired
    private UserWrongQuestionStatMapper userWrongQuestionStatMapper;

    @Autowired
    private AuthService authService;

    @GetMapping("/session/history")
    public ResultDTO<PageWithSummaryDTO<PracticeHistoryDTO, PracticeHistorySummaryDTO>> getPracticeHistory(
            HttpServletRequest request,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        Integer userId = authService.getCurrentUserId(request.getHeader("Authorization"));
        PageParams pageParams = resolvePageParams(page, pageSize);
        PracticeHistorySummaryDTO summary = practiceSessionMapper.selectPracticeHistorySummaryByUserId(userId);
        if (summary == null) {
            summary = emptyPracticeHistorySummary();
        }
        Long total = summary.getTotalCount();
        List<PracticeHistoryDTO> records = practiceSessionMapper.selectPracticeHistoryByUserId(
                userId,
                pageParams.pageSize,
                pageParams.offset);
        return ResultDTO.success(new PageWithSummaryDTO<>(
                records,
                total,
                pageParams.page,
                pageParams.pageSize,
                summary));
    }

    @GetMapping("/wrong-questions")
    public ResultDTO<PageWithSummaryDTO<WrongQuestionDTO, WrongQuestionSummaryDTO>> getWrongQuestions(
            HttpServletRequest request,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        Integer userId = authService.getCurrentUserId(request.getHeader("Authorization"));
        PageParams pageParams = resolvePageParams(page, pageSize);
        WrongQuestionSummaryDTO summary = userWrongQuestionStatMapper.selectSummaryByUserId(userId);
        if (summary == null) {
            summary = emptyWrongQuestionSummary();
        }
        Long total = summary.getTotalCount();
        List<WrongQuestionDTO> records = userWrongQuestionStatMapper.selectByUserId(
                userId,
                pageParams.pageSize,
                pageParams.offset);
        return ResultDTO.success(new PageWithSummaryDTO<>(
                records,
                total,
                pageParams.page,
                pageParams.pageSize,
                summary));
    }

    private PracticeHistorySummaryDTO emptyPracticeHistorySummary() {
        PracticeHistorySummaryDTO summary = new PracticeHistorySummaryDTO();
        summary.setTotalCount(0L);
        summary.setInProgressCount(0L);
        summary.setCompletedCount(0L);
        summary.setAnsweredCount(0L);
        return summary;
    }

    private WrongQuestionSummaryDTO emptyWrongQuestionSummary() {
        WrongQuestionSummaryDTO summary = new WrongQuestionSummaryDTO();
        summary.setTotalCount(0L);
        summary.setMasterCount(0L);
        summary.setFrequentCount(0L);
        summary.setPaperCount(0L);
        return summary;
    }

    private PageParams resolvePageParams(Integer page, Integer pageSize) {
        int safePage = page == null || page < 1 ? 1 : page;
        int safePageSize = pageSize == null || pageSize < 1 ? 10 : Math.min(pageSize, 100);
        return new PageParams(safePage, safePageSize, (safePage - 1) * safePageSize);
    }

    private static class PageParams {
        private final Integer page;
        private final Integer pageSize;
        private final Integer offset;

        private PageParams(Integer page, Integer pageSize, Integer offset) {
            this.page = page;
            this.pageSize = pageSize;
            this.offset = offset;
        }
    }
}
