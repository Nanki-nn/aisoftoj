package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.common.AnswerRevisionConflictException;
import com.nan.aisoftoj.common.ConflictException;
import com.nan.aisoftoj.common.UnprocessableEntityException;
import com.nan.aisoftoj.consts.PracticeSessionState;
import com.nan.aisoftoj.dto.QuestionRecordUpdateResponse;
import com.nan.aisoftoj.dto.UpdateQuestionRecordDTO;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.entity.PracticeSessionQuestionRecord;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.PracticeSessionQuestionRecordMapper;
import com.nan.aisoftoj.service.QuestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
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
        ReflectionTestUtils.setField(service, "gradingService", new GradingServiceImpl());
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
        when(practiceSessionMapper.selectByIdForUpdate(12)).thenReturn(session);

        UpdateQuestionRecordDTO request = updateRequest(0L, "mutation-finished", "B");

        assertThrows(
                ConflictException.class,
                () -> service.updatePracticeSessionQuestionRecord(7, 30, request));

        verify(questionRecordMapper, never()).updateById(any());
        verify(practiceSessionMapper, never()).updateById(any());
        verifyNoInteractions(questionService);
    }

    @Test
    void repeatedMutationIdReturnsCurrentRecordWithoutWritingAgain() {
        PracticeSessionQuestionRecord record = questionRecord(3L, "mutation-1", "B");
        when(questionRecordMapper.selectById(30)).thenReturn(record);
        when(practiceSessionMapper.selectByIdForUpdate(12)).thenReturn(doingSession());
        when(questionRecordMapper.selectByIdForUpdate(30)).thenReturn(record);

        QuestionRecordUpdateResponse result = service.updatePracticeSessionQuestionRecord(
                7,
                30,
                updateRequest(2L, "mutation-1", "B"));

        assertEquals(30, result.getRecordId());
        assertEquals(3L, result.getAnswerRevision());
        assertEquals("mutation-1", result.getMutationId());
        assertEquals("B", result.getUserAnswer());
        verify(questionRecordMapper, never()).updateDraftWithRevision(any(), any(), any(), any(), any());
        verify(practiceSessionMapper, never()).updateById(any());
        verifyNoInteractions(questionService);
    }

    @Test
    void staleRevisionReturnsCurrentServerStateWithoutOverwritingIt() {
        PracticeSessionQuestionRecord record = questionRecord(3L, "mutation-server", "C");
        when(questionRecordMapper.selectById(30)).thenReturn(record);
        when(practiceSessionMapper.selectByIdForUpdate(12)).thenReturn(doingSession());
        when(questionRecordMapper.selectByIdForUpdate(30)).thenReturn(record);

        AnswerRevisionConflictException exception = assertThrows(
                AnswerRevisionConflictException.class,
                () -> service.updatePracticeSessionQuestionRecord(
                        7,
                        30,
                        updateRequest(2L, "mutation-client", "B")));

        assertEquals(3L, exception.getCurrentState().getAnswerRevision());
        assertEquals("C", exception.getCurrentState().getUserAnswer());
        assertEquals("mutation-server", exception.getCurrentState().getMutationId());
        verify(questionRecordMapper, never()).updateDraftWithRevision(any(), any(), any(), any(), any());
        verify(practiceSessionMapper, never()).updateById(any());
        verifyNoInteractions(questionService);
    }

    @Test
    void matchingRevisionStoresADraftAndAdvancesTheVersion() {
        PracticeSessionQuestionRecord record = questionRecord(2L, "mutation-old", "A");
        when(questionRecordMapper.selectById(30)).thenReturn(record);
        when(practiceSessionMapper.selectByIdForUpdate(12)).thenReturn(doingSession());
        when(questionRecordMapper.selectByIdForUpdate(30)).thenReturn(record);
        when(questionRecordMapper.updateDraftWithRevision(30, "B", 10, 2L, "mutation-new"))
                .thenReturn(1);
        when(questionRecordMapper.selectCount(any())).thenReturn(1L);

        QuestionRecordUpdateResponse result = service.updatePracticeSessionQuestionRecord(
                7,
                30,
                updateRequest(2L, "mutation-new", "B"));

        assertEquals(3L, result.getAnswerRevision());
        assertEquals("mutation-new", result.getMutationId());
        assertEquals("B", result.getUserAnswer());
        assertEquals(false, result.getIsSubmitted());
        assertEquals(null, result.getIsCorrect());
        verify(questionRecordMapper).updateDraftWithRevision(30, "B", 10, 2L, "mutation-new");
        verify(practiceSessionMapper).updateById(any());
        verifyNoInteractions(questionService);
    }

    @Test
    void rejectsDraftLongerThanTenThousandCodePointsBeforeWriting() {
        PracticeSessionQuestionRecord record = questionRecord(2L, "mutation-old", "A");
        when(questionRecordMapper.selectById(30)).thenReturn(record);
        when(practiceSessionMapper.selectByIdForUpdate(12)).thenReturn(doingSession());
        when(questionRecordMapper.selectByIdForUpdate(30)).thenReturn(record);

        assertThrows(
                UnprocessableEntityException.class,
                () -> service.updatePracticeSessionQuestionRecord(
                        7,
                        30,
                        updateRequest(2L, "mutation-long", repeat("题", 10_001))));

        verify(questionRecordMapper, never()).updateDraftWithRevision(any(), any(), any(), any(), any());
        verify(practiceSessionMapper, never()).updateById(any());
    }

    @Test
    void practiceConfirmationGradesFromTheSnapshotAndClosesTheRecord() {
        PracticeSessionQuestionRecord record = questionRecord(2L, "mutation-old", "A");
        record.setGradingStrategySnapshot("EXACT_CHOICE");
        record.setScoreSnapshot(new BigDecimal("2.00"));
        when(questionRecordMapper.selectById(30)).thenReturn(record);
        when(practiceSessionMapper.selectByIdForUpdate(12)).thenReturn(doingSession());
        when(questionRecordMapper.selectByIdForUpdate(30)).thenReturn(record);

        Question question = new Question();
        question.setId(5);
        question.setAnswer("A");
        question.setQuestionType(1);
        when(questionService.getById(5)).thenReturn(question);
        when(questionRecordMapper.confirmWithRevision(
                eq(30),
                eq("a"),
                eq(10),
                eq(2L),
                eq("mutation-confirm"),
                eq(true),
                any(Date.class)))
                .thenReturn(1);
        when(questionRecordMapper.selectCount(any())).thenReturn(1L);

        UpdateQuestionRecordDTO request = updateRequest(2L, "mutation-confirm", "a");
        request.setConfirm(true);
        QuestionRecordUpdateResponse result = service.updatePracticeSessionQuestionRecord(7, 30, request);

        assertEquals(3L, result.getAnswerRevision());
        assertEquals(true, result.getIsSubmitted());
        assertEquals(true, result.getIsCorrect());
        assertNotNull(result.getConfirmedAt());
        assertEquals(0L, result.getConfirmedAt().getTime() % 1000L);
        verify(questionRecordMapper, never()).updateDraftWithRevision(any(), any(), any(), any(), any());
    }

    @Test
    void examModeRejectsSingleQuestionConfirmation() {
        PracticeSessionQuestionRecord record = questionRecord(2L, "mutation-old", "A");
        when(questionRecordMapper.selectById(30)).thenReturn(record);
        PracticeSession session = doingSession();
        session.setExamMode("exam");
        when(practiceSessionMapper.selectByIdForUpdate(12)).thenReturn(session);
        when(questionRecordMapper.selectByIdForUpdate(30)).thenReturn(record);

        UpdateQuestionRecordDTO request = updateRequest(2L, "mutation-confirm", "A");
        request.setConfirm(true);

        assertThrows(
                ConflictException.class,
                () -> service.updatePracticeSessionQuestionRecord(7, 30, request));
        verify(questionRecordMapper, never()).confirmWithRevision(any(), any(), any(), any(), any(), any(), any());
        verify(questionRecordMapper, never()).updateDraftWithRevision(any(), any(), any(), any(), any());
        verifyNoInteractions(questionService);
    }

    @Test
    void manualConfirmationRemainsUngradedWithoutAStandardAnswer() {
        PracticeSessionQuestionRecord record = questionRecord(2L, "mutation-old", "初稿");
        record.setGradingStrategySnapshot("MANUAL");
        record.setScoreSnapshot(new BigDecimal("15.00"));
        when(questionRecordMapper.selectById(30)).thenReturn(record);
        when(practiceSessionMapper.selectByIdForUpdate(12)).thenReturn(doingSession());
        when(questionRecordMapper.selectByIdForUpdate(30)).thenReturn(record);

        Question question = new Question();
        question.setId(5);
        question.setQuestionType(5);
        when(questionService.getById(5)).thenReturn(question);
        when(questionRecordMapper.confirmWithRevision(
                eq(30),
                eq("案例作答"),
                eq(10),
                eq(2L),
                eq("mutation-manual"),
                isNull(),
                any(Date.class)))
                .thenReturn(1);
        when(questionRecordMapper.selectCount(any())).thenReturn(1L);

        UpdateQuestionRecordDTO request = updateRequest(2L, "mutation-manual", "案例作答");
        request.setConfirm(true);
        QuestionRecordUpdateResponse result = service.updatePracticeSessionQuestionRecord(7, 30, request);

        assertEquals(true, result.getIsSubmitted());
        assertEquals(null, result.getIsCorrect());
        assertNotNull(result.getConfirmedAt());
    }

    @Test
    void repeatedConfirmationMutationReturnsTheConfirmedRecordIdempotently() {
        PracticeSessionQuestionRecord record = questionRecord(3L, "mutation-confirm", "A");
        record.setConfirmedAt(new Date());
        record.setIsSubmitted(true);
        record.setIsCorrect(true);
        when(questionRecordMapper.selectById(30)).thenReturn(record);
        when(practiceSessionMapper.selectByIdForUpdate(12)).thenReturn(doingSession());
        when(questionRecordMapper.selectByIdForUpdate(30)).thenReturn(record);

        UpdateQuestionRecordDTO request = updateRequest(2L, "mutation-confirm", "A");
        request.setConfirm(true);
        QuestionRecordUpdateResponse result = service.updatePracticeSessionQuestionRecord(7, 30, request);

        assertEquals(3L, result.getAnswerRevision());
        assertEquals(true, result.getIsSubmitted());
        assertNotNull(result.getConfirmedAt());
        verify(questionRecordMapper, never()).confirmWithRevision(any(), any(), any(), any(), any(), any(), any());
        verify(questionRecordMapper, never()).updateDraftWithRevision(any(), any(), any(), any(), any());
        verifyNoInteractions(questionService);
    }

    private PracticeSession doingSession() {
        PracticeSession session = new PracticeSession();
        session.setId(12);
        session.setUserId(7);
        session.setStatus(PracticeSessionState.DOING.getCode());
        session.setExamMode("practice");
        return session;
    }

    private PracticeSessionQuestionRecord questionRecord(Long revision, String mutationId, String answer) {
        PracticeSessionQuestionRecord record = new PracticeSessionQuestionRecord();
        record.setId(30);
        record.setSessionId(12);
        record.setQuestionId(5);
        record.setAnswerRevision(revision);
        record.setLastMutationId(mutationId);
        record.setUserAnswer(answer);
        record.setSpendTime(9);
        return record;
    }

    private UpdateQuestionRecordDTO updateRequest(Long revision, String mutationId, String answer) {
        UpdateQuestionRecordDTO request = new UpdateQuestionRecordDTO();
        request.setExpectedRevision(revision);
        request.setMutationId(mutationId);
        request.setUserAnswer(answer);
        request.setSpendTime(10);
        return request;
    }

    private String repeat(String value, int count) {
        StringBuilder builder = new StringBuilder(value.length() * count);
        for (int i = 0; i < count; i++) {
            builder.append(value);
        }
        return builder.toString();
    }
}
