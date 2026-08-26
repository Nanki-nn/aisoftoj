package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.crypto.EncryptedQuestionResponse;
import com.nan.aisoftoj.dto.*;
import com.nan.aisoftoj.service.AuthService;
import com.nan.aisoftoj.service.PracticeSessionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;

/**
 *  刷题会话
 */
@RestController
public class PracticeSessionController {

    @Autowired
    private PracticeSessionService practiceSessionService;

    @Autowired
    private AuthService authService;

     /**
     * 开始刷题会话
     * URI: /session/start
     * Method: POST
     * Content-Type: application/json
     * 请求体：CreatePracticeSessionReq
     * 返回：
     */
     @EncryptedQuestionResponse
     @PostMapping("/session/start")
     public ResultDTO<StartPracticeSessionRes> startPracticeSession(@RequestBody StartPracticeSessionReq startPracticeSessionReq,
                                                                   HttpServletRequest request) {
        Integer userId = authService.getCurrentUserId(request.getHeader("Authorization"));
        StartPracticeSessionRes res = practiceSessionService.startPracticeSession(userId, startPracticeSessionReq);
        return ResultDTO.success(res);
     }


    /**
     * 获取刷题会话详情
     * URI: /session/{sessionId}
     * Method: GET
     * 返回刷题会话详情
     */
    @EncryptedQuestionResponse
    @GetMapping("/session/{sessionId}")
    public ResultDTO<GETPracticeSessionRes> getPracticeSessionDetail(@PathVariable Integer sessionId,
                                                                     HttpServletRequest request) {
        Integer userId = authService.getCurrentUserId(request.getHeader("Authorization"));
        GETPracticeSessionRes paperRecordDetail = practiceSessionService.getPracticeSessionDetail(userId, sessionId);
        return ResultDTO.success(paperRecordDetail);
     }

    /**
     * 获取已完成会话的完整复盘。进行中会话不能通过该端点读取答案。
     */
    @EncryptedQuestionResponse
    @GetMapping("/session/{sessionId}/result")
    public ResultDTO<GETPracticeSessionRes> getPracticeSessionResult(@PathVariable Integer sessionId,
                                                                     HttpServletRequest request) {
        Integer userId = authService.getCurrentUserId(request.getHeader("Authorization"));
        return ResultDTO.success(practiceSessionService.getPracticeSessionResult(userId, sessionId));
    }

    /**
     * 暂停进行中的刷题会话，退出页面后的时间不再计入答题用时。
     */
    @PatchMapping("/session/{sessionId}/pause")
    public ResultDTO<Void> pausePracticeSession(@PathVariable Integer sessionId,
                                                HttpServletRequest request) {
        Integer userId = authService.getCurrentUserId(request.getHeader("Authorization"));
        practiceSessionService.pausePracticeSession(userId, sessionId);
        return ResultDTO.success();
    }

    /**
     * 显式恢复暂停中的刷题会话。普通详情读取不会改变计时状态。
     */
    @PatchMapping("/session/{sessionId}/resume")
    public ResultDTO<Void> resumePracticeSession(@PathVariable Integer sessionId,
                                                 HttpServletRequest request) {
        Integer userId = authService.getCurrentUserId(request.getHeader("Authorization"));
        practiceSessionService.resumePracticeSession(userId, sessionId);
        return ResultDTO.success();
    }



    /**
     * 交卷
     * URI: /session/submit/{sessionId}
     * Method: POST
     */
    @PostMapping("/session/submit/{sessionId}")
    public ResultDTO<PaperSubmitResponse> submitPracticeSession(@PathVariable Integer sessionId,
                                                                @RequestBody PaperSubmitRequest request,
                                                                HttpServletRequest httpRequest) {
        Integer userId = authService.getCurrentUserId(httpRequest.getHeader("Authorization"));

        PaperSubmitResponse response = practiceSessionService.submitPracticeSession(userId, sessionId, request);
        return ResultDTO.success(response);
    }



}
