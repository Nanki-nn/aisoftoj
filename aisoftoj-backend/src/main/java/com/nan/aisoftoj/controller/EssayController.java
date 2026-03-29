package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.EssayHistoryItem;
import com.nan.aisoftoj.dto.EssayResultResponse;
import com.nan.aisoftoj.dto.EssaySubmitRequest;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.service.AuthService;
import com.nan.aisoftoj.service.EssayService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/essay")
public class EssayController {

    @Autowired
    private EssayService essayService;

    @Autowired
    private AuthService authService;

    /**
     * 提交论文批改请求
     * URI: /essay/submit
     * Method: POST
     */
    @PostMapping("/submit")
    public ResultDTO<?> submitEssay(@RequestBody EssaySubmitRequest request,
                                    HttpServletRequest httpRequest) {
        Long userId = getCurrentUserId(httpRequest);
        return essayService.submitEssay(request, userId);
    }

    /**
     * 获取批改结果
     * URI: /essay/result/{id}
     * Method: GET
     */
    @GetMapping("/result/{id}")
    public ResultDTO<EssayResultResponse> getResult(@PathVariable Long id,
                                                    HttpServletRequest httpRequest) {
        Long userId = getCurrentUserId(httpRequest);
        return essayService.getResult(id, userId);
    }

    /**
     * 获取历史提交记录
     * URI: /essay/history
     * Method: GET
     */
    @GetMapping("/history")
    public ResultDTO<List<EssayHistoryItem>> getHistory(HttpServletRequest httpRequest) {
        Long userId = getCurrentUserId(httpRequest);
        return essayService.getHistory(userId);
    }

    /**
     * 获取论文题目列表
     * URI: /essay/questions
     * Method: GET
     */
    @GetMapping("/questions")
    public ResultDTO<List<Map<String, Object>>> getQuestions(
            @RequestParam(required = false) String subject) {
        return essayService.getQuestions(subject);
    }

    private Long getCurrentUserId(HttpServletRequest request) {
        String token = request.getHeader("Authorization");
        String userId = authService.getCurrentUser(token).getId();
        return Long.parseLong(userId);
    }
}
