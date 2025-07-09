package com.nan.aisoftoj.service;

import com.nan.aisoftoj.entity.Question;
import java.util.List;

public interface QuestionService {
    List<Question> search(String keyword, Long categoryId, Integer type, int page, int size);
    Question getRandomQuestion(Long categoryId);
    List<Question> getSequenceQuestions(Long categoryId, int page, int size);
    List<Question> getSpecialQuestions(Long categoryId);
} 