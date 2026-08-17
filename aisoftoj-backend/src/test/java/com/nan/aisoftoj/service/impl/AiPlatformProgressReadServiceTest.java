package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.common.ResourceNotFoundException;
import com.nan.aisoftoj.dto.PracticeHistorySummaryDTO;
import com.nan.aisoftoj.dto.PracticeHistoryDTO;
import com.nan.aisoftoj.dto.ai.AiPracticeHistoryPageDTO;
import com.nan.aisoftoj.dto.ai.AiWrongQuestionReviewDTO;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.entity.PracticeSessionQuestionRecord;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.entity.UserWrongQuestionStat;
import com.nan.aisoftoj.mapper.PaperMapper;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.PracticeSessionQuestionRecordMapper;
import com.nan.aisoftoj.mapper.QuestionMapper;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Collections;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiPlatformProgressReadServiceTest {

    @Mock
    private UserMapper userMapper;
    @Mock
    private PracticeSessionMapper practiceSessionMapper;
    @Mock
    private UserWrongQuestionStatMapper wrongQuestionStatMapper;
    @Mock
    private PaperMapper paperMapper;
    @Mock
    private QuestionMapper questionMapper;
    @Mock
    private PracticeSessionQuestionRecordMapper questionRecordMapper;
    @InjectMocks
    private AiPlatformReadServiceImpl service;

    @Test
    void completedOwnedSessionUnlocksWrongQuestionReview() {
        UserWrongQuestionStat wrong = new UserWrongQuestionStat();
        wrong.setId(31L);
        wrong.setUserId(7);
        wrong.setPaperId(4);
        wrong.setPaperName("试卷");
        wrong.setQuestionId(9);
        wrong.setErrorCount(2);
        wrong.setImportanceLevel("high");
        wrong.setLastSessionId(12);
        wrong.setLastWrongTime(Date.from(Instant.parse("2026-08-10T00:00:00Z")));
        wrong.setIsDeleted(0);
        when(wrongQuestionStatMapper.selectById(31L)).thenReturn(wrong);

        PracticeSession session = new PracticeSession();
        session.setId(12);
        session.setUserId(7);
        session.setPaperId(4);
        session.setStatus(1);
        session.setIsDeleted(0);
        when(practiceSessionMapper.selectById(12)).thenReturn(session);

        PracticeSessionQuestionRecord record = new PracticeSessionQuestionRecord();
        record.setSessionId(12);
        record.setQuestionId(9);
        record.setUserAnswer("B");
        record.setSpendTime(25);
        when(questionRecordMapper.selectOne(any())).thenReturn(record);

        Question question = new Question();
        question.setId(9);
        question.setName("题目");
        question.setIntro("题干");
        question.setOptions("[]");
        question.setAnswer("A");
        question.setAnalysis("解析");
        question.setQuestionType(1);
        question.setDifficulty(2);
        question.setIsDeleted(0);
        when(questionMapper.selectById(9)).thenReturn(question);

        AiWrongQuestionReviewDTO result = service.reviewWrongQuestion(7, 31L);

        assertEquals("B", result.getUserAnswer());
        assertEquals("A", result.getCorrectAnswer());
        assertEquals("解析", result.getAnalysis());
        assertEquals(25, result.getSpendTime());
    }

    @Test
    void anotherUsersWrongQuestionLooksMissing() {
        UserWrongQuestionStat wrong = new UserWrongQuestionStat();
        wrong.setId(31L);
        wrong.setUserId(99);
        wrong.setIsDeleted(0);
        when(wrongQuestionStatMapper.selectById(31L)).thenReturn(wrong);

        assertThrows(ResourceNotFoundException.class,
                () -> service.reviewWrongQuestion(7, 31L));
    }

    @Test
    void practiceHistoryPageUsesFullDatasetSummary() {
        PracticeHistoryDTO session = new PracticeHistoryDTO();
        session.setSessionId(14);
        session.setExamName("案例试卷");
        session.setExamMode("practice");
        session.setExamType("案例分析");
        session.setStatus("inProgress");
        session.setAnsweredCount(8);
        session.setTotalCount(20);
        session.setCreateTime("2026-08-11 08:00:00");
        when(practiceSessionMapper.selectPracticeHistoryByUserId(7, 10, 10))
                .thenReturn(Collections.singletonList(session));
        PracticeHistorySummaryDTO summary = new PracticeHistorySummaryDTO();
        summary.setTotalCount(40L);
        summary.setInProgressCount(3L);
        summary.setCompletedCount(37L);
        summary.setAnsweredCount(300L);
        when(practiceSessionMapper.selectPracticeHistorySummaryByUserId(7)).thenReturn(summary);

        AiPracticeHistoryPageDTO result = service.listPracticeHistory(7, 2, 10);

        assertEquals(40L, result.getTotal());
        assertEquals(2, result.getPage());
        assertEquals("in_progress", result.getRecords().get(0).getStatus());
        assertEquals("案例分析", result.getRecords().get(0).getExamType());
        assertEquals(300L, result.getSummary().getAnsweredCount());
    }

    @Test
    void practiceHistoryRejectsOversizedPages() {
        assertThrows(IllegalArgumentException.class,
                () -> service.listPracticeHistory(7, 1, 21));
    }
}
