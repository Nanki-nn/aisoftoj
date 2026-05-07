package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.PaperDTO;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.service.AuthService;
import com.nan.aisoftoj.service.PaperService;
import com.nan.aisoftoj.service.QuestionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

@RestController
@RequestMapping("/paper")
public class PaperController {

    @Autowired
    private PaperService paperService;

    @Autowired
    private AuthService authService;
    
    @Autowired
    private QuestionService questionService;

    /**
     * 获取所有试卷（不筛选，前端做筛选）
     * URI: /paper/list
     * Method: GET
     */
    @GetMapping("/list")
    public ResultDTO<List<PaperDTO>> getPapers(HttpServletRequest request) {
        Integer userId = authService.getCurrentUserId(request.getHeader("Authorization"));
        List<PaperDTO> papers = paperService.getAllPapers(userId);
        return ResultDTO.success(papers);
    }

    /**
     * 获取试卷的所有题目
     * URI: /paper/detail/{paperId}
     * Method: GET
     */
    @GetMapping("/detail/{paperId}")
    public ResultDTO<List<Question>> getPaperQuestions(@PathVariable Integer paperId) {
        List<Question> questions = questionService.getQuestionsByPaperId(paperId);
        return ResultDTO.success(questions);
    }


}
