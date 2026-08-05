package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.consts.PracticeSessionState;
import com.nan.aisoftoj.dto.GETPracticeSessionRes;
import com.nan.aisoftoj.dto.PaperSubmitResponse;
import com.nan.aisoftoj.entity.Paper;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.PracticeSessionQuestionRecordMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import com.nan.aisoftoj.service.PaperService;
import com.nan.aisoftoj.service.QuestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PracticeSessionServiceImplTest {

    @Mock
    private PaperService paperService;
    @Mock
    private QuestionService questionService;
    @Mock
    private PracticeSessionMapper practiceSessionMapper;
    @Mock
    private PracticeSessionQuestionRecordMapper practiceSessionQuestionRecordMapper;
    @Mock
    private UserWrongQuestionStatMapper userWrongQuestionStatMapper;

    private PracticeSessionServiceImpl practiceSessionService;

    @BeforeEach
    void setUp() {
        practiceSessionService = new PracticeSessionServiceImpl();
        ReflectionTestUtils.setField(practiceSessionService, "paperService", paperService);
        ReflectionTestUtils.setField(practiceSessionService, "questionService", questionService);
        ReflectionTestUtils.setField(practiceSessionService, "practiceSessionMapper", practiceSessionMapper);
        ReflectionTestUtils.setField(
                practiceSessionService,
                "practiceSessionQuestionRecordMapper",
                practiceSessionQuestionRecordMapper);
        ReflectionTestUtils.setField(
                practiceSessionService,
                "userWrongQuestionStatMapper",
                userWrongQuestionStatMapper);
    }

    @Test
    void pauseStoresCurrentTimeForDoingSession() {
        PracticeSession session = doingSession();
        session.setEndTime(new Date(0L));
        when(practiceSessionMapper.selectById(12)).thenReturn(session);
        long beforePause = System.currentTimeMillis();

        practiceSessionService.pausePracticeSession(7, 12);

        ArgumentCaptor<PracticeSession> updateCaptor = ArgumentCaptor.forClass(PracticeSession.class);
        verify(practiceSessionMapper).updateById(updateCaptor.capture());
        PracticeSession update = updateCaptor.getValue();
        assertEquals(12, update.getId());
        assertTrue(update.getEndTime().getTime() >= beforePause);
        assertTrue(update.getEndTime().getTime() <= System.currentTimeMillis());
    }

    @Test
    void continuingPausedSessionExcludesPausedIntervalFromElapsedTime() {
        long now = System.currentTimeMillis();
        PracticeSession session = doingSession();
        session.setStartTime(new Date(now - 300_000L));
        session.setEndTime(new Date(now - 120_000L));
        when(practiceSessionMapper.selectById(12)).thenReturn(session);

        Paper paper = new Paper();
        paper.setId(3);
        paper.setName("测试试卷");
        when(paperService.getById(3)).thenReturn(paper);
        when(questionService.listByPaperId(3)).thenReturn(Collections.emptyList());
        when(practiceSessionQuestionRecordMapper.selectList(any())).thenReturn(Collections.emptyList());

        GETPracticeSessionRes result = practiceSessionService.getPracticeSessionDetail(7, 12);

        long elapsedAfterResume = System.currentTimeMillis() - result.getStartTime().getTime();
        assertTrue(elapsedAfterResume >= 179_000L && elapsedAfterResume <= 181_000L);
        assertEquals(0L, result.getEndTime().getTime());

        ArgumentCaptor<PracticeSession> updateCaptor = ArgumentCaptor.forClass(PracticeSession.class);
        verify(practiceSessionMapper).updateById(updateCaptor.capture());
        assertEquals(result.getStartTime(), updateCaptor.getValue().getStartTime());
        assertEquals(0L, updateCaptor.getValue().getEndTime().getTime());
    }

    @Test
    void resubmittingFinishedSessionReturnsPersistedResultWithoutMutatingRecords() {
        PracticeSession session = doingSession();
        session.setStatus(PracticeSessionState.FINISHED.getCode());
        session.setScore(new BigDecimal("62.00"));
        session.setTotalScore(new BigDecimal("75.00"));
        when(practiceSessionMapper.selectById(12)).thenReturn(session);

        PaperSubmitResponse result = practiceSessionService.submitPracticeSession(7, 12, null);

        assertEquals(12L, result.getRecordId());
        assertEquals(new BigDecimal("62.00"), result.getScore());
        assertEquals(new BigDecimal("75.00"), result.getTotalScore());
        assertEquals(PracticeSessionState.FINISHED.getCode(), result.getStatus());
        verify(practiceSessionMapper, never()).updateById(any());
        verifyNoInteractions(questionService, practiceSessionQuestionRecordMapper, userWrongQuestionStatMapper);
    }

    private PracticeSession doingSession() {
        PracticeSession session = new PracticeSession();
        session.setId(12);
        session.setUserId(7);
        session.setPaperId(3);
        session.setStatus(PracticeSessionState.DOING.getCode());
        session.setStartTime(new Date());
        return session;
    }
}
