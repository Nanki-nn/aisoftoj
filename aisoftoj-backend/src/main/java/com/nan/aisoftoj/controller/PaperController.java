package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.common.ResourceNotFoundException;
import com.nan.aisoftoj.dto.PaperDTO;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.entity.Paper;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.service.AuthService;
import com.nan.aisoftoj.service.PaperService;
import com.nan.aisoftoj.service.QuestionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
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

    /** 游客可浏览目录；有效登录用户额外获得自己的练习状态。 */
    @GetMapping("/list")
    public ResultDTO<List<PaperDTO>> getPapers(
            HttpServletRequest request, HttpServletResponse response) {
        response.setHeader("Cache-Control", "private, no-store");
        String authorization = request.getHeader("Authorization");
        Integer userId = hasText(authorization)
                ? authService.getCurrentUserId(authorization)
                : null;
        return ResultDTO.success(paperService.getAllPapers(userId));
    }

    /** 题目内容属于登录后能力，并且仅开放已发布试卷。 */
    @GetMapping("/detail/{paperId}")
    public ResultDTO<List<Question>> getPaperQuestions(
            @PathVariable Integer paperId, HttpServletRequest request) {
        authService.getCurrentUserId(request.getHeader("Authorization"));
        Paper paper = paperService.getPublishedPaper(paperId);
        if (paper == null) {
            throw new ResourceNotFoundException("试卷不存在或暂未发布");
        }
        return ResultDTO.success(questionService.getQuestionsByPaperId(paperId));
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
