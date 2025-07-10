package com.nan.aisoftoj.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.mapper.QuestionMapper;
import com.nan.aisoftoj.service.QuestionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Random;

@Service
public class QuestionServiceImpl implements QuestionService {
    @Autowired
    private QuestionMapper questionMapper;

    @Override
    public List<Question> search(String keyword, Long categoryId, Integer type, int page, int size) {
        LambdaQueryWrapper<Question> wrapper = Wrappers.lambdaQuery();
        
        // 关键词搜索
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(Question::getContent, keyword);
        }
        
        // 分类筛选
        if (categoryId != null) {
            wrapper.eq(Question::getCategoryId, categoryId);
        }
        
        // 题型筛选
        if (type != null) {
            wrapper.eq(Question::getType, type);
        }
        
        // 分页
        int offset = (page - 1) * size;
        wrapper.last("LIMIT " + offset + "," + size);
        
        return questionMapper.selectList(wrapper);
    }

    @Override
    public Question getRandomQuestion(Long categoryId) {
        LambdaQueryWrapper<Question> wrapper = Wrappers.lambdaQuery();
        
        if (categoryId != null) {
            wrapper.eq(Question::getCategoryId, categoryId);
        }
        
        List<Question> list = questionMapper.selectList(wrapper);
        if (list == null || list.isEmpty()) {
            return null;
        }
        
        int idx = new Random().nextInt(list.size());
        return list.get(idx);
    }

    @Override
    public List<Question> getSequenceQuestions(Long categoryId, int page, int size) {
        LambdaQueryWrapper<Question> wrapper = Wrappers.lambdaQuery();
        
        if (categoryId != null) {
            wrapper.eq(Question::getCategoryId, categoryId);
        }
        
        // 按ID顺序排列
        wrapper.orderByAsc(Question::getId);
        
        // 分页
        int offset = (page - 1) * size;
        wrapper.last("LIMIT " + offset + "," + size);
        
        return questionMapper.selectList(wrapper);
    }

    @Override
    public List<Question> getSpecialQuestions(Long categoryId) {
        LambdaQueryWrapper<Question> wrapper = Wrappers.lambdaQuery();
        
        if (categoryId != null) {
            wrapper.eq(Question::getCategoryId, categoryId);
        }
        
        // 专项刷题：可以添加特殊条件，比如只获取中等难度以上的题目
        wrapper.ge(Question::getDifficulty, 2);
        
        return questionMapper.selectList(wrapper);
    }
} 