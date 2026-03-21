package com.nan.aisoftoj.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.nan.aisoftoj.dto.GetQuestionDetailDTO;
import com.nan.aisoftoj.dto.QuestionRecordRequest;
import com.nan.aisoftoj.entity.Question;

import java.util.List;

public interface QuestionService {

    List<Question> getQuestionsByPaperId(Integer paperId);

    GetQuestionDetailDTO getQuestionById(Integer questionId, Boolean withAnswer);

    boolean updateQuestionRecord(QuestionRecordRequest request);

    List<Question> listByPaperId(Integer paperId);

}