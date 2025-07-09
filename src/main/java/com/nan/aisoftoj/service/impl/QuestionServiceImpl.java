package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.mapper.QuestionMapper;
import com.nan.aisoftoj.service.QuestionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class QuestionServiceImpl implements QuestionService {
    @Autowired
    private QuestionMapper questionMapper;

    @Override
    public List<Question> search(String keyword, Long categoryId, Integer type, int page, int size) {
        // TODO: 搜索题目逻辑
        return null;
    }

    @Override
    public Question getRandomQuestion(Long categoryId) {
        // TODO: 随机题目逻辑
        return null;
    }

    @Override
    public List<Question> getSequenceQuestions(Long categoryId, int page, int size) {
        // TODO: 顺序刷题逻辑
        return null;
    }

    @Override
    public List<Question> getSpecialQuestions(Long categoryId) {
        // TODO: 专项刷题逻辑
        return null;
    }
} 