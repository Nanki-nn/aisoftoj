package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.entity.Paper;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.mapper.PaperMapper;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.QuestionMapper;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import com.nan.aisoftoj.dto.ai.AiPaperDTO;
import com.nan.aisoftoj.dto.ai.AiQuestionDTO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiPlatformCatalogReadServiceTest {

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
    @InjectMocks
    private AiPlatformReadServiceImpl service;

    @Test
    void paperAggregationSelectsMostActiveOngoingSessionDeterministically() {
        Paper paper = new Paper();
        paper.setId(3);
        paper.setName("2026 综合知识");
        paper.setPaperCateId(1);
        paper.setQuestionTotal(50);
        paper.setIsDeleted(false);
        paper.setPublishStatus(true);
        when(paperMapper.selectList(any())).thenReturn(Collections.singletonList(paper));

        PracticeSession older = session(11, 3, 0, 10, 80);
        PracticeSession newer = session(12, 3, 0, 20, 999);
        when(practiceSessionMapper.selectList(any())).thenReturn(Arrays.asList(older, newer));

        List<AiPaperDTO> result = service.listPapers(7);

        assertEquals(1, result.size());
        assertEquals("in_progress", result.get(0).getPracticeStatus());
        assertEquals(12, result.get(0).getOngoingSessionId());
        assertEquals(50, result.get(0).getCompletedQuestionCount());
    }

    @Test
    void questionOutputContainsNoAnswerBearingFields() {
        Question question = new Question();
        question.setId(8);
        question.setName("题目");
        question.setIntro("题干");
        question.setOptions("[{\"keyStr\":\"A\",\"valueStr\":\"选项A\",\"orderNum\":1}]");
        question.setAnswer("A");
        question.setAnalysis("解析");
        question.setQuestionType(1);
        question.setDifficulty(3);
        question.setIsDeleted(0);
        when(questionMapper.selectById(8)).thenReturn(question);
        when(questionMapper.countPublishedPaperRelations(8)).thenReturn(1);

        AiQuestionDTO result = service.getQuestion(8);

        assertEquals(8, result.getQuestionId());
        assertEquals("题干", result.getContent());
        assertEquals("single_choice", result.getQuestionType());
        assertEquals("hard", result.getDifficulty());
        assertEquals("A", result.getOptions().get(0).getKey());
        assertEquals("选项A", result.getOptions().get(0).getContent());
    }

    @Test
    void invalidQuestionIdIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.getQuestion(0));
    }

    private PracticeSession session(int id, int paperId, int status, int day, int answered) {
        PracticeSession session = new PracticeSession();
        session.setId(id);
        session.setPaperId(paperId);
        session.setStatus(status);
        session.setAnsweredCount(answered);
        session.setUpdateTime(new Date(1_700_000_000_000L + day * 86_400_000L));
        return session;
    }
}
