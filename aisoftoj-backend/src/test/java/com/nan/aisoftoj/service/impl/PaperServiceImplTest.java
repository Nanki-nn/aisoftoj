package com.nan.aisoftoj.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nan.aisoftoj.consts.PaperStatus;
import com.nan.aisoftoj.consts.PracticeSessionState;
import com.nan.aisoftoj.dto.PaperDTO;
import com.nan.aisoftoj.entity.Paper;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.mapper.PaperMapper;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaperServiceImplTest {

    @Mock
    private PaperMapper paperMapper;

    @Mock
    private PracticeSessionMapper practiceSessionMapper;

    private PaperServiceImpl paperService;

    @BeforeEach
    void setUp() {
        paperService = new PaperServiceImpl();
        ReflectionTestUtils.setField(paperService, "paperMapper", paperMapper);
        ReflectionTestUtils.setField(paperService, "practiceSessionMapper", practiceSessionMapper);
    }

    @Test
    void guestCatalogOmitsPersonalProgressFields() throws Exception {
        when(paperMapper.selectList(any())).thenReturn(Collections.singletonList(paper(1, 75)));

        PaperDTO result = paperService.getAllPapers(null).get(0);

        assertNull(result.getReadCt());
        assertNull(result.getDoingSessionId());
        assertNull(result.getPaperStatus());
        assertNull(result.getCompletedCount());
        assertFalse(new ObjectMapper().writeValueAsString(result).contains("completedCount"));
        verifyNoInteractions(practiceSessionMapper);
    }

    @Test
    void authenticatedCatalogReturnsProgressForEveryPaperState() {
        Paper inProgressPaper = paper(1, 75);
        Paper completedPaper = paper(2, 60);
        Paper notStartedPaper = paper(3, 50);
        when(paperMapper.selectList(any())).thenReturn(Arrays.asList(
                inProgressPaper,
                completedPaper,
                notStartedPaper));
        when(practiceSessionMapper.selectList(any())).thenReturn(Arrays.asList(
                session(11, 1, PracticeSessionState.DOING.getCode(), 18),
                session(12, 1, PracticeSessionState.FINISHED.getCode(), 75),
                session(21, 2, PracticeSessionState.FINISHED.getCode(), 37)));

        List<PaperDTO> results = paperService.getAllPapers(7);

        PaperDTO inProgress = results.get(0);
        assertEquals(PaperStatus.IN_PROGRESS, inProgress.getPaperStatus());
        assertEquals(11, inProgress.getDoingSessionId());
        assertEquals(18, inProgress.getCompletedCount());
        assertEquals(2, inProgress.getReadCt());

        PaperDTO completed = results.get(1);
        assertEquals(PaperStatus.COMPLETED, completed.getPaperStatus());
        assertNull(completed.getDoingSessionId());
        assertEquals(60, completed.getCompletedCount());
        assertEquals(1, completed.getReadCt());

        PaperDTO notStarted = results.get(2);
        assertEquals(PaperStatus.NOT_STARTED, notStarted.getPaperStatus());
        assertNull(notStarted.getDoingSessionId());
        assertEquals(0, notStarted.getCompletedCount());
        assertEquals(0, notStarted.getReadCt());
    }

    @Test
    void inProgressCatalogUsesTheSameSessionForIdAndCompletedCount() {
        when(paperMapper.selectList(any())).thenReturn(Collections.singletonList(paper(1, 75)));
        when(practiceSessionMapper.selectList(any())).thenReturn(Arrays.asList(
                session(11, 1, PracticeSessionState.DOING.getCode(), 18),
                session(12, 1, PracticeSessionState.DOING.getCode(), 24)));

        PaperDTO result = paperService.getAllPapers(7).get(0);

        assertEquals(12, result.getDoingSessionId());
        assertEquals(24, result.getCompletedCount());
    }

    private Paper paper(int id, int questionTotal) {
        Paper paper = new Paper();
        paper.setId(id);
        paper.setName("paper-" + id);
        paper.setSubjectName("系统架构设计师");
        paper.setPaperCateId(1);
        paper.setPaperYear(2025);
        paper.setPaperMonth(5);
        paper.setQuestionTotal(questionTotal);
        return paper;
    }

    private PracticeSession session(int id, int paperId, int status, int answeredCount) {
        PracticeSession session = new PracticeSession();
        session.setId(id);
        session.setPaperId(paperId);
        session.setStatus(status);
        session.setAnsweredCount(answeredCount);
        return session;
    }
}
