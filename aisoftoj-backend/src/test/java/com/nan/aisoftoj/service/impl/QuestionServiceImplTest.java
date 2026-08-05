package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.dto.GetQuestionDetailDTO;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.mapper.QuestionMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuestionServiceImplTest {

    @Mock
    private QuestionMapper questionMapper;

    private QuestionServiceImpl questionService;

    @BeforeEach
    void setUp() {
        questionService = new QuestionServiceImpl();
        ReflectionTestUtils.setField(questionService, "questionMapper", questionMapper);
    }

    @Test
    void paperDetailQuestionsNeverContainAnswersOrAnalysis() {
        Question question = publishedQuestion();
        when(questionMapper.selectQuestionsByPaperId(3)).thenReturn(Collections.singletonList(question));

        List<Question> questions = questionService.getQuestionsByPaperId(3);

        assertNull(questions.get(0).getAnswer());
        assertNull(questions.get(0).getAnalysis());
    }

    @Test
    void ordinaryQuestionDetailOmitsAnswerAndAnalysis() {
        when(questionMapper.selectById(9)).thenReturn(publishedQuestion());
        when(questionMapper.countPublishedPaperRelations(9)).thenReturn(1);

        GetQuestionDetailDTO result = questionService.getQuestionById(9, false);

        assertNull(result.getAnswer());
        assertNull(result.getAnalysis());
    }

    @Test
    void administratorQuestionDetailCanIncludeAnswerAndAnalysis() {
        when(questionMapper.selectById(9)).thenReturn(publishedQuestion());
        when(questionMapper.countPublishedPaperRelations(9)).thenReturn(1);

        GetQuestionDetailDTO result = questionService.getQuestionById(9, true);

        assertEquals("A", result.getAnswer());
        assertEquals("答案解析", result.getAnalysis());
    }

    private Question publishedQuestion() {
        Question question = new Question();
        question.setId(9);
        question.setIsDeleted(0);
        question.setAnswer("A");
        question.setAnalysis("答案解析");
        return question;
    }
}
