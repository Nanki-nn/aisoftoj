package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.GetQuestionDetailDTO;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.service.AuthService;
import com.nan.aisoftoj.service.QuestionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;

@RestController
public class QuestionController {

    @Autowired
    private QuestionService questionService;

    @Autowired
    private AuthService authService;

    /**
     * 获取题目详情
     * URI: /paper/question/{questionId}?withAnswer=false
     * Method: GET
     */
    @GetMapping("/question/{questionId}")
    public ResultDTO<GetQuestionDetailDTO> getQuestionDetail(@PathVariable Integer questionId,
                                                             @RequestParam(defaultValue = "false") Boolean withAnswer,
                                                             HttpServletRequest request) {
        authService.getCurrentUserId(request.getHeader("Authorization"));
        GetQuestionDetailDTO questionDetailDTO = questionService.getQuestionById(questionId, withAnswer);
        return ResultDTO.success(questionDetailDTO);
    }

}
