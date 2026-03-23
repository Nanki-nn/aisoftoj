package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.PracticeHistoryDTO;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.dto.WrongQuestionDTO;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class UserStatsController {

    @Autowired
    private PracticeSessionMapper practiceSessionMapper;

    @Autowired
    private UserWrongQuestionStatMapper userWrongQuestionStatMapper;

    @GetMapping("/session/history")
    public ResultDTO<List<PracticeHistoryDTO>> getPracticeHistory() {
        return ResultDTO.success(practiceSessionMapper.selectPracticeHistoryByUserId(1));
    }

    @GetMapping("/wrong-questions")
    public ResultDTO<List<WrongQuestionDTO>> getWrongQuestions() {
        return ResultDTO.success(userWrongQuestionStatMapper.selectByUserId(1));
    }
}
