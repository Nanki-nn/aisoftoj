package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.PageDTO;
import com.nan.aisoftoj.dto.PracticeHistoryDTO;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.dto.WrongQuestionDTO;
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
    public ResultDTO<PageDTO<PracticeHistoryDTO>> getPracticeHistory(
            HttpServletRequest request,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        Integer userId = authService.getCurrentUserId(request.getHeader("Authorization"));
        PageParams pageParams = resolvePageParams(page, pageSize);
        Long total = practiceSessionMapper.countPracticeHistoryByUserId(userId);
        List<PracticeHistoryDTO> records = practiceSessionMapper.selectPracticeHistoryByUserId(
                userId,
                pageParams.pageSize,
                pageParams.offset);
        return ResultDTO.success(new PageDTO<>(records, total, pageParams.page, pageParams.pageSize));
    }

    @GetMapping("/wrong-questions")
    public ResultDTO<PageDTO<WrongQuestionDTO>> getWrongQuestions(
            HttpServletRequest request,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        Integer userId = authService.getCurrentUserId(request.getHeader("Authorization"));
        PageParams pageParams = resolvePageParams(page, pageSize);
        Long total = userWrongQuestionStatMapper.countByUserId(userId);
        List<WrongQuestionDTO> records = userWrongQuestionStatMapper.selectByUserId(
                userId,
                pageParams.pageSize,
                pageParams.offset);
        return ResultDTO.success(new PageDTO<>(records, total, pageParams.page, pageParams.pageSize));
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
