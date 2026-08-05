package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.common.ConflictException;
import com.nan.aisoftoj.dto.admin.AdminQuestionRequest;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.mapper.QuestionMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminQuestionImmutabilityTest {

    @Mock
    private QuestionMapper questionMapper;

    private AdminServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AdminServiceImpl();
        ReflectionTestUtils.setField(service, "questionMapper", questionMapper);
    }

    @Test
    void rejectsEditingAQuestionUsedByAPublishedPaper() {
        when(questionMapper.selectById(9)).thenReturn(question(9));
        when(questionMapper.countPublishedPaperRelations(9)).thenReturn(1);

        assertThrows(ConflictException.class, () -> service.updateQuestion(9, request(2)));

        verify(questionMapper, never()).updateById(any());
    }

    @Test
    void rejectsDeletingAQuestionAlreadySnapshottedByASession() {
        when(questionMapper.selectById(9)).thenReturn(question(9));
        when(questionMapper.countPublishedPaperRelations(9)).thenReturn(0);
        when(questionMapper.countSessionQuestionRecords(9)).thenReturn(1);

        assertThrows(ConflictException.class, () -> service.deleteQuestion(9));

        verify(questionMapper, never()).updateById(any());
    }

    @Test
    void derivesTheGradingStrategyWhenAnUnreferencedQuestionIsUpdated() {
        Question question = question(9);
        when(questionMapper.selectById(9)).thenReturn(question, question);
        when(questionMapper.countPublishedPaperRelations(9)).thenReturn(0);
        when(questionMapper.countSessionQuestionRecords(9)).thenReturn(0);

        service.updateQuestion(9, request(2));

        assertEquals("SET_CHOICE", question.getGradingStrategy());
        verify(questionMapper).updateById(question);
    }

    private Question question(Integer id) {
        Question question = new Question();
        question.setId(id);
        question.setIsDeleted(0);
        return question;
    }

    private AdminQuestionRequest request(Integer questionType) {
        AdminQuestionRequest request = new AdminQuestionRequest();
        request.setName("测试题");
        request.setIntro("题干");
        request.setOptions("[]");
        request.setAnswer("A");
        request.setAnalysis("解析");
        request.setQuestionType(questionType);
        request.setDifficulty(2);
        return request;
    }
}
