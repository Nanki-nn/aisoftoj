package com.nan.aisoftoj.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.nan.aisoftoj.dto.GetQuestionDetailDTO;
import com.nan.aisoftoj.dto.QuestionRecordRequest;
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
    public List<Question> getQuestionsByPaperId(Integer paperId) {
        // 这里应该查询试卷关联的题目列表


        return questionMapper.selectQuestionsByPaperId(paperId);
    }

    @Override
    public GetQuestionDetailDTO getQuestionById(Integer questionId, Boolean withAnswer) {
        Question question = questionMapper.selectById(questionId);
        // 如果不包含答案，则清空答案字段
        if (!withAnswer && question != null) {
            question.setAnswer(null);
        }

        if (question == null) {
            return null;
        }

        GetQuestionDetailDTO questionDetailDTO = new GetQuestionDetailDTO();
        questionDetailDTO.setId(question.getId());
        questionDetailDTO.setName(question.getName());
        questionDetailDTO.setIntro(question.getIntro());
        questionDetailDTO.setAnalysis(question.getAnalysis());
        questionDetailDTO.setQuestionType(question.getQuestionType());
        questionDetailDTO.setDifficulty(question.getDifficulty());
        questionDetailDTO.setReadCt(question.getReadCt());
        questionDetailDTO.setAnswer(question.getAnswer());
        return questionDetailDTO;
    }

    @Override
    public boolean updateQuestionRecord(QuestionRecordRequest request) {
        // 这里应该更新题目答题记录
        return true; // 示例返回值
    }

    @Override
    public List<Question> listByPaperId(Integer paperId) {
        return questionMapper.selectQuestionsByPaperId(paperId);
    }


}