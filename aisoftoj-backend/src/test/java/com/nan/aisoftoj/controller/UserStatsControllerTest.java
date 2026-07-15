package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.PageWithSummaryDTO;
import com.nan.aisoftoj.dto.PracticeHistoryDTO;
import com.nan.aisoftoj.dto.PracticeHistorySummaryDTO;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.dto.WrongQuestionDTO;
import com.nan.aisoftoj.dto.WrongQuestionSummaryDTO;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import com.nan.aisoftoj.service.AuthService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.servlet.http.HttpServletRequest;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserStatsControllerTest {

    @Mock
    private PracticeSessionMapper practiceSessionMapper;

    @Mock
    private UserWrongQuestionStatMapper userWrongQuestionStatMapper;

    @Mock
    private AuthService authService;

    @Mock
    private HttpServletRequest request;

    @InjectMocks
    private UserStatsController controller;

    @Test
    void practiceHistoryReturnsFullSummaryWithPage() {
        when(request.getHeader("Authorization")).thenReturn("Bearer token");
        when(authService.getCurrentUserId("Bearer token")).thenReturn(7);
        PracticeHistorySummaryDTO summary = new PracticeHistorySummaryDTO();
        summary.setTotalCount(47L);
        summary.setInProgressCount(8L);
        summary.setCompletedCount(39L);
        summary.setAnsweredCount(412L);
        when(practiceSessionMapper.selectPracticeHistorySummaryByUserId(7)).thenReturn(summary);
        when(practiceSessionMapper.selectPracticeHistoryByUserId(7, 10, 10))
                .thenReturn(Collections.singletonList(new PracticeHistoryDTO()));

        ResultDTO<PageWithSummaryDTO<PracticeHistoryDTO, PracticeHistorySummaryDTO>> result =
                controller.getPracticeHistory(request, 2, 10);

        assertEquals(47L, result.getData().getTotal());
        assertEquals(2, result.getData().getPage());
        assertEquals(8L, result.getData().getSummary().getInProgressCount());
        assertEquals(39L, result.getData().getSummary().getCompletedCount());
        assertEquals(412L, result.getData().getSummary().getAnsweredCount());
    }

    @Test
    void wrongQuestionsReturnsFullSummaryWithPage() {
        when(request.getHeader("Authorization")).thenReturn("Bearer token");
        when(authService.getCurrentUserId("Bearer token")).thenReturn(7);
        WrongQuestionSummaryDTO summary = new WrongQuestionSummaryDTO();
        summary.setTotalCount(18L);
        summary.setMasterCount(3L);
        summary.setFrequentCount(7L);
        summary.setPaperCount(5L);
        when(userWrongQuestionStatMapper.selectSummaryByUserId(7)).thenReturn(summary);
        when(userWrongQuestionStatMapper.selectByUserId(7, 20, 0))
                .thenReturn(Collections.singletonList(new WrongQuestionDTO()));

        ResultDTO<PageWithSummaryDTO<WrongQuestionDTO, WrongQuestionSummaryDTO>> result =
                controller.getWrongQuestions(request, 1, 20);

        assertEquals(18L, result.getData().getTotal());
        assertEquals(3L, result.getData().getSummary().getMasterCount());
        assertEquals(7L, result.getData().getSummary().getFrequentCount());
        assertEquals(5L, result.getData().getSummary().getPaperCount());
    }

    @Test
    void emptyDatasetsReturnZeroSummariesInsteadOfNulls() {
        when(request.getHeader("Authorization")).thenReturn("Bearer token");
        when(authService.getCurrentUserId("Bearer token")).thenReturn(7);
        when(practiceSessionMapper.selectPracticeHistorySummaryByUserId(7)).thenReturn(null);
        when(practiceSessionMapper.selectPracticeHistoryByUserId(7, 10, 0))
                .thenReturn(Collections.emptyList());
        when(userWrongQuestionStatMapper.selectSummaryByUserId(7)).thenReturn(null);
        when(userWrongQuestionStatMapper.selectByUserId(7, 10, 0))
                .thenReturn(Collections.emptyList());

        PracticeHistorySummaryDTO historySummary =
                controller.getPracticeHistory(request, 1, 10).getData().getSummary();
        WrongQuestionSummaryDTO wrongSummary =
                controller.getWrongQuestions(request, 1, 10).getData().getSummary();

        assertNotNull(historySummary);
        assertEquals(0L, historySummary.getTotalCount());
        assertEquals(0L, historySummary.getInProgressCount());
        assertEquals(0L, historySummary.getCompletedCount());
        assertEquals(0L, historySummary.getAnsweredCount());
        assertNotNull(wrongSummary);
        assertEquals(0L, wrongSummary.getTotalCount());
        assertEquals(0L, wrongSummary.getMasterCount());
        assertEquals(0L, wrongSummary.getFrequentCount());
        assertEquals(0L, wrongSummary.getPaperCount());
    }
}
