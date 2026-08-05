package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.common.ConflictException;
import com.nan.aisoftoj.common.UnprocessableEntityException;
import com.nan.aisoftoj.consts.PracticeSessionState;
import com.nan.aisoftoj.dto.GETPracticeSessionRes;
import com.nan.aisoftoj.dto.PaperSubmitRequest;
import com.nan.aisoftoj.dto.PaperSubmitResponse;
import com.nan.aisoftoj.dto.SessionQuestionSnapshot;
import com.nan.aisoftoj.dto.StartPracticeSessionReq;
import com.nan.aisoftoj.dto.StartPracticeSessionRes;
import com.nan.aisoftoj.entity.Paper;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.entity.PracticeSessionQuestionRecord;
import com.nan.aisoftoj.entity.UserWrongQuestionStat;
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
import org.springframework.dao.DuplicateKeyException;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.times;
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
        ReflectionTestUtils.setField(practiceSessionService, "gradingService", new GradingServiceImpl());
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
        when(questionService.listSessionQuestionSnapshotsBySessionId(12)).thenReturn(Collections.emptyList());

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
    void newSessionPersistsDeterministicQuestionScoreAndStrategySnapshots() {
        Paper paper = publishedPaper();
        when(paperService.getById(3)).thenReturn(paper);
        when(practiceSessionMapper.selectOne(any())).thenReturn(null);
        doAnswer(invocation -> {
            PracticeSession inserted = invocation.getArgument(0);
            inserted.setId(41);
            return 1;
        }).when(practiceSessionMapper).insert(any());

        List<SessionQuestionSnapshot> snapshots = Arrays.asList(
                snapshot(101, 9, 1, "2.50", "EXACT_CHOICE"),
                snapshot(102, 10, 2, "5.00", "MANUAL"));
        when(questionService.listSessionQuestionSnapshotsByPaperId(3)).thenReturn(snapshots);
        when(questionService.listSessionQuestionSnapshotsBySessionId(41))
                .thenReturn(Collections.emptyList());

        StartPracticeSessionReq request = new StartPracticeSessionReq();
        request.setPaperId(3);
        request.setMode(1);

        practiceSessionService.startPracticeSession(7, request);

        ArgumentCaptor<PracticeSession> sessionCaptor = ArgumentCaptor.forClass(PracticeSession.class);
        verify(practiceSessionMapper).insert(sessionCaptor.capture());
        assertEquals(new BigDecimal("2.50"), sessionCaptor.getValue().getTotalScore());

        ArgumentCaptor<PracticeSessionQuestionRecord> recordCaptor =
                ArgumentCaptor.forClass(PracticeSessionQuestionRecord.class);
        verify(practiceSessionQuestionRecordMapper, times(2)).insert(recordCaptor.capture());
        List<PracticeSessionQuestionRecord> records = recordCaptor.getAllValues();
        assertEquals(101, records.get(0).getPaperQuestionRelationId());
        assertEquals(1, records.get(0).getQuestionOrder());
        assertEquals(new BigDecimal("2.50"), records.get(0).getScoreSnapshot());
        assertEquals("EXACT_CHOICE", records.get(0).getGradingStrategySnapshot());
        assertEquals(102, records.get(1).getPaperQuestionRelationId());
        assertEquals(2, records.get(1).getQuestionOrder());
    }

    @Test
    void submitUsesSessionRecordScoresInsteadOfCurrentPaperEnumeration() {
        PracticeSession session = doingSession();
        when(practiceSessionMapper.selectByIdForUpdate(12)).thenReturn(session);

        PracticeSessionQuestionRecord record = new PracticeSessionQuestionRecord();
        record.setId(30);
        record.setSessionId(12);
        record.setQuestionId(9);
        record.setQuestionOrder(1);
        record.setScoreSnapshot(new BigDecimal("2.50"));
        record.setGradingStrategySnapshot("EXACT_CHOICE");
        when(practiceSessionQuestionRecordMapper.selectBySessionIdOrdered(12))
                .thenReturn(Collections.singletonList(record));

        when(questionService.listSessionQuestionSnapshotsBySessionId(12))
                .thenReturn(Collections.singletonList(snapshot(101, 9, 1, "2.50", "EXACT_CHOICE")));
        when(paperService.getById(3)).thenReturn(publishedPaper());

        PaperSubmitRequest.QuestionAnswer answer = new PaperSubmitRequest.QuestionAnswer();
        answer.setQuestionId(9);
        answer.setUserAnswer("A");
        answer.setSpendTime(8);
        PaperSubmitRequest request = new PaperSubmitRequest();
        request.setAnswers(Collections.singletonList(answer));

        PaperSubmitResponse result = practiceSessionService.submitPracticeSession(7, 12, request);

        assertEquals(new BigDecimal("2.50"), result.getScore());
        assertEquals(new BigDecimal("2.50"), result.getTotalScore());
        verify(questionService, never()).listByPaperId(any());
        verify(questionService, never()).listSessionQuestionSnapshotsByPaperId(any());
    }

    @Test
    void manualSnapshotIsAnsweredButNotAutoGradedOrRecordedAsWrong() {
        PracticeSession session = doingSession();
        when(practiceSessionMapper.selectByIdForUpdate(12)).thenReturn(session);

        PracticeSessionQuestionRecord record = new PracticeSessionQuestionRecord();
        record.setId(30);
        record.setSessionId(12);
        record.setQuestionId(9);
        record.setQuestionOrder(1);
        record.setScoreSnapshot(new BigDecimal("15.00"));
        record.setGradingStrategySnapshot("MANUAL");
        when(practiceSessionQuestionRecordMapper.selectBySessionIdOrdered(12))
                .thenReturn(Collections.singletonList(record));

        SessionQuestionSnapshot manualSnapshot = snapshot(101, 9, 1, "15.00", "MANUAL");
        manualSnapshot.setAnswer("参考答案");
        when(questionService.listSessionQuestionSnapshotsBySessionId(12))
                .thenReturn(Collections.singletonList(manualSnapshot));
        when(paperService.getById(3)).thenReturn(publishedPaper());

        PaperSubmitRequest.QuestionAnswer answer = new PaperSubmitRequest.QuestionAnswer();
        answer.setQuestionId(9);
        answer.setUserAnswer("学生案例答案");
        PaperSubmitRequest request = new PaperSubmitRequest();
        request.setAnswers(Collections.singletonList(answer));

        PaperSubmitResponse result = practiceSessionService.submitPracticeSession(7, 12, request);

        assertEquals(BigDecimal.ZERO, result.getScore());
        assertEquals(BigDecimal.ZERO, result.getTotalScore());
        ArgumentCaptor<PracticeSessionQuestionRecord> updateCaptor =
                ArgumentCaptor.forClass(PracticeSessionQuestionRecord.class);
        verify(practiceSessionQuestionRecordMapper).updateById(updateCaptor.capture());
        assertEquals(null, updateCaptor.getValue().getIsCorrect());
        assertEquals(true, updateCaptor.getValue().getIsSubmitted());
        verifyNoInteractions(userWrongQuestionStatMapper);
    }

    @Test
    void wrongObjectiveSubmissionUsesTheAtomicBusinessKeyUpsert() {
        PracticeSession session = doingSession();
        when(practiceSessionMapper.selectByIdForUpdate(12)).thenReturn(session);

        PracticeSessionQuestionRecord record = new PracticeSessionQuestionRecord();
        record.setId(30);
        record.setSessionId(12);
        record.setQuestionId(9);
        record.setQuestionOrder(1);
        record.setScoreSnapshot(BigDecimal.ONE);
        record.setGradingStrategySnapshot("EXACT_CHOICE");
        when(practiceSessionQuestionRecordMapper.selectBySessionIdOrdered(12))
                .thenReturn(Collections.singletonList(record));
        when(questionService.listSessionQuestionSnapshotsBySessionId(12))
                .thenReturn(Collections.singletonList(snapshot(101, 9, 1, "1.00", "EXACT_CHOICE")));
        when(paperService.getById(3)).thenReturn(publishedPaper());

        PaperSubmitRequest.QuestionAnswer answer = new PaperSubmitRequest.QuestionAnswer();
        answer.setQuestionId(9);
        answer.setUserAnswer("B");
        PaperSubmitRequest request = new PaperSubmitRequest();
        request.setAnswers(Collections.singletonList(answer));

        practiceSessionService.submitPracticeSession(7, 12, request);

        ArgumentCaptor<UserWrongQuestionStat> statCaptor =
                ArgumentCaptor.forClass(UserWrongQuestionStat.class);
        verify(userWrongQuestionStatMapper).upsertActiveWrongQuestion(statCaptor.capture());
        UserWrongQuestionStat stat = statCaptor.getValue();
        assertEquals(7, stat.getUserId());
        assertEquals(9, stat.getQuestionId());
        assertEquals(12, stat.getLastSessionId());
        assertEquals(1, stat.getErrorCount());
        verify(userWrongQuestionStatMapper, never()).selectOne(any());
        verify(userWrongQuestionStatMapper, never()).insert(any());
        verify(userWrongQuestionStatMapper, never()).updateById(any());
    }

    @Test
    void submitRejectsOverlongAnswerBeforePersistingAnyRecordOrSessionResult() {
        PracticeSession session = doingSession();
        when(practiceSessionMapper.selectByIdForUpdate(12)).thenReturn(session);

        PracticeSessionQuestionRecord record = new PracticeSessionQuestionRecord();
        record.setId(30);
        record.setSessionId(12);
        record.setQuestionId(9);
        record.setScoreSnapshot(BigDecimal.ONE);
        record.setGradingStrategySnapshot("EXACT_CHOICE");
        when(practiceSessionQuestionRecordMapper.selectBySessionIdOrdered(12))
                .thenReturn(Collections.singletonList(record));
        when(questionService.listSessionQuestionSnapshotsBySessionId(12))
                .thenReturn(Collections.singletonList(snapshot(101, 9, 1, "1.00", "EXACT_CHOICE")));
        when(paperService.getById(3)).thenReturn(publishedPaper());

        PaperSubmitRequest.QuestionAnswer answer = new PaperSubmitRequest.QuestionAnswer();
        answer.setQuestionId(9);
        answer.setUserAnswer(repeat("答", 10_001));
        PaperSubmitRequest request = new PaperSubmitRequest();
        request.setAnswers(Collections.singletonList(answer));

        assertThrows(
                UnprocessableEntityException.class,
                () -> practiceSessionService.submitPracticeSession(7, 12, request));

        verify(practiceSessionQuestionRecordMapper, never()).updateById(any());
        verify(practiceSessionMapper, never()).updateById(any());
        verifyNoInteractions(userWrongQuestionStatMapper);
    }

    @Test
    void resubmittingFinishedSessionReturnsPersistedResultWithoutMutatingRecords() {
        PracticeSession session = doingSession();
        session.setStatus(PracticeSessionState.FINISHED.getCode());
        session.setScore(new BigDecimal("62.00"));
        session.setTotalScore(new BigDecimal("75.00"));
        when(practiceSessionMapper.selectByIdForUpdate(12)).thenReturn(session);

        PaperSubmitResponse result = practiceSessionService.submitPracticeSession(7, 12, null);

        assertEquals(12L, result.getRecordId());
        assertEquals(new BigDecimal("62.00"), result.getScore());
        assertEquals(new BigDecimal("75.00"), result.getTotalScore());
        assertEquals(PracticeSessionState.FINISHED.getCode(), result.getStatus());
        verify(practiceSessionMapper).selectByIdForUpdate(12);
        verify(practiceSessionMapper, never()).selectById(12);
        verify(practiceSessionMapper, never()).updateById(any());
        verifyNoInteractions(questionService, practiceSessionQuestionRecordMapper, userWrongQuestionStatMapper);
    }

    @Test
    void concurrentStartReturnsTheWinningActiveSessionWithoutReinitializingQuestions() {
        Paper paper = publishedPaper();
        when(paperService.getById(3)).thenReturn(paper);

        PracticeSession winningSession = doingSession();
        when(practiceSessionMapper.selectOne(any())).thenReturn(null, winningSession);
        when(practiceSessionMapper.insert(any())).thenThrow(new DuplicateKeyException("active session"));
        when(questionService.listSessionQuestionSnapshotsByPaperId(3))
                .thenReturn(Collections.singletonList(snapshot(101, 9, 1, "1.00", "EXACT_CHOICE")));
        when(questionService.listSessionQuestionSnapshotsBySessionId(12)).thenReturn(Collections.emptyList());

        StartPracticeSessionReq request = new StartPracticeSessionReq();
        request.setPaperId(3);
        request.setMode(1);

        StartPracticeSessionRes result = practiceSessionService.startPracticeSession(7, request);

        assertEquals(12, result.getPracticeSessionId());
        assertEquals(PracticeSessionState.DOING.getCode(), result.getStatus());
        verify(practiceSessionMapper, times(2)).selectOne(any());
        verify(practiceSessionQuestionRecordMapper, never()).insert(any());
    }

    @Test
    void ongoingExamHidesAnswerAnalysisAndCorrectness() {
        PracticeSession session = doingSession();
        session.setExamMode("exam");
        when(practiceSessionMapper.selectById(12)).thenReturn(session);
        when(paperService.getById(3)).thenReturn(publishedPaper());

        SessionQuestionSnapshot snapshot = snapshot(101, 9, 1, "1.00", "EXACT_CHOICE");
        snapshot.setAnalysis("答案解析");
        snapshot.setIsCorrect(true);
        snapshot.setConfirmedAt(new Date());
        when(questionService.listSessionQuestionSnapshotsBySessionId(12))
                .thenReturn(Collections.singletonList(snapshot));

        GETPracticeSessionRes result = practiceSessionService.getPracticeSessionDetail(7, 12);

        assertNull(result.getQuestionList().get(0).getAnswer());
        assertNull(result.getQuestionList().get(0).getAnalysis());
        assertNull(result.getQuestionList().get(0).getIsCorrect());
    }

    @Test
    void ongoingPracticeRevealsAnswerOnlyAfterQuestionConfirmation() {
        PracticeSession session = doingSession();
        session.setExamMode("practice");
        when(practiceSessionMapper.selectById(12)).thenReturn(session);
        when(paperService.getById(3)).thenReturn(publishedPaper());

        SessionQuestionSnapshot draft = snapshot(101, 9, 1, "1.00", "EXACT_CHOICE");
        draft.setAnalysis("未确认解析");
        draft.setIsCorrect(false);
        SessionQuestionSnapshot confirmed = snapshot(102, 10, 2, "1.00", "EXACT_CHOICE");
        confirmed.setAnalysis("已确认解析");
        confirmed.setIsCorrect(true);
        confirmed.setConfirmedAt(new Date());
        when(questionService.listSessionQuestionSnapshotsBySessionId(12))
                .thenReturn(Arrays.asList(draft, confirmed));

        GETPracticeSessionRes result = practiceSessionService.getPracticeSessionDetail(7, 12);

        assertNull(result.getQuestionList().get(0).getAnswer());
        assertNull(result.getQuestionList().get(0).getAnalysis());
        assertNull(result.getQuestionList().get(0).getIsCorrect());
        assertEquals("A", result.getQuestionList().get(1).getAnswer());
        assertEquals("已确认解析", result.getQuestionList().get(1).getAnalysis());
        assertEquals(true, result.getQuestionList().get(1).getIsCorrect());
    }

    @Test
    void completedSessionDetailStaysRedactedUntilResultEndpoint() {
        PracticeSession session = doingSession();
        session.setExamMode("exam");
        session.setStatus(PracticeSessionState.FINISHED.getCode());
        when(practiceSessionMapper.selectById(12)).thenReturn(session);
        when(paperService.getById(3)).thenReturn(publishedPaper());

        SessionQuestionSnapshot snapshot = snapshot(101, 9, 1, "1.00", "EXACT_CHOICE");
        snapshot.setAnalysis("完成解析");
        snapshot.setIsCorrect(true);
        when(questionService.listSessionQuestionSnapshotsBySessionId(12))
                .thenReturn(Collections.singletonList(snapshot));

        GETPracticeSessionRes detail = practiceSessionService.getPracticeSessionDetail(7, 12);

        assertNull(detail.getQuestionList().get(0).getAnswer());
        assertNull(detail.getQuestionList().get(0).getAnalysis());
        assertNull(detail.getQuestionList().get(0).getIsCorrect());
    }

    @Test
    void completedSessionResultReturnsFullReview() {
        PracticeSession session = doingSession();
        session.setExamMode("exam");
        session.setStatus(PracticeSessionState.FINISHED.getCode());
        when(practiceSessionMapper.selectById(12)).thenReturn(session);
        when(paperService.getById(3)).thenReturn(publishedPaper());

        SessionQuestionSnapshot snapshot = snapshot(101, 9, 1, "1.00", "EXACT_CHOICE");
        snapshot.setAnalysis("完成解析");
        snapshot.setIsCorrect(true);
        when(questionService.listSessionQuestionSnapshotsBySessionId(12))
                .thenReturn(Collections.singletonList(snapshot));

        GETPracticeSessionRes result = practiceSessionService.getPracticeSessionResult(7, 12);

        assertEquals("A", result.getQuestionList().get(0).getAnswer());
        assertEquals("完成解析", result.getQuestionList().get(0).getAnalysis());
        assertEquals(true, result.getQuestionList().get(0).getIsCorrect());
    }

    @Test
    void ongoingSessionHasNoResultReview() {
        when(practiceSessionMapper.selectById(12)).thenReturn(doingSession());

        assertThrows(ConflictException.class,
                () -> practiceSessionService.getPracticeSessionResult(7, 12));

        verifyNoInteractions(questionService, paperService);
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

    private Paper publishedPaper() {
        Paper paper = new Paper();
        paper.setId(3);
        paper.setName("测试试卷");
        paper.setPublishStatus(true);
        paper.setIsDeleted(false);
        return paper;
    }

    private SessionQuestionSnapshot snapshot(
            Integer relationId,
            Integer questionId,
            Integer questionOrder,
            String score,
            String gradingStrategy) {
        SessionQuestionSnapshot snapshot = new SessionQuestionSnapshot();
        snapshot.setPaperQuestionRelationId(relationId);
        snapshot.setQuestionId(questionId);
        snapshot.setQuestionOrder(questionOrder);
        snapshot.setScoreSnapshot(new BigDecimal(score));
        snapshot.setGradingStrategySnapshot(gradingStrategy);
        snapshot.setName("题目" + questionId);
        snapshot.setAnswer("A");
        snapshot.setQuestionType("MANUAL".equals(gradingStrategy) ? 5 : 1);
        return snapshot;
    }

    private String repeat(String value, int count) {
        StringBuilder builder = new StringBuilder(value.length() * count);
        for (int i = 0; i < count; i++) {
            builder.append(value);
        }
        return builder.toString();
    }
}
