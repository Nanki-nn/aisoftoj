package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.common.ConflictException;
import com.nan.aisoftoj.consts.PracticeSessionState;
import com.nan.aisoftoj.dto.UpdateQuestionRecordDTO;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.entity.PracticeSessionQuestionRecord;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.PracticeSessionQuestionRecordMapper;
import com.nan.aisoftoj.service.QuestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PracticeSessionQuestionRecordServiceImplTest {

    @Mock
    private PracticeSessionQuestionRecordMapper questionRecordMapper;
    @Mock
    private PracticeSessionMapper practiceSessionMapper;
    @Mock
    private QuestionService questionService;

    private PracticeSessionQuestionRecordServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new PracticeSessionQuestionRecordServiceImpl();
        ReflectionTestUtils.setField(service, "practiceSessionQuestionRecordMapper", questionRecordMapper);
        ReflectionTestUtils.setField(service, "practiceSessionMapper", practiceSessionMapper);
        ReflectionTestUtils.setField(service, "questionService", questionService);
    }

    @Test
    void rejectsAnswerPatchAfterSessionIsFinished() {
        PracticeSessionQuestionRecord record = new PracticeSessionQuestionRecord();
        record.setId(30);
        record.setSessionId(12);
        record.setQuestionId(5);
        when(questionRecordMapper.selectById(30)).thenReturn(record);

        PracticeSession session = new PracticeSession();
        session.setId(12);
        session.setUserId(7);
        session.setStatus(PracticeSessionState.FINISHED.getCode());
        when(practiceSessionMapper.selectOne(any())).thenReturn(session);

        UpdateQuestionRecordDTO request = new UpdateQuestionRecordDTO();
        request.setUserAnswer("B");

        assertThrows(
                ConflictException.class,
                () -> service.updatePracticeSessionQuestionRecord(7, 30, request));

        verify(questionRecordMapper, never()).updateById(any());
        verify(practiceSessionMapper, never()).updateById(any());
        verifyNoInteractions(questionService);
    }
}
