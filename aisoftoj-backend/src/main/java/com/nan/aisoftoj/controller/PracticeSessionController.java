package com.nan.aisoftoj.controller;

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
    @GetMapping("/session/{sessionId}")
    public ResultDTO<GETPracticeSessionRes> getPracticeSessionDetail(@PathVariable Integer sessionId,
                                                                     HttpServletRequest request) {
        Integer userId = authService.getCurrentUserId(request.getHeader("Authorization"));
        GETPracticeSessionRes paperRecordDetail = practiceSessionService.getPracticeSessionDetail(userId, sessionId);
        return ResultDTO.success(paperRecordDetail);
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
