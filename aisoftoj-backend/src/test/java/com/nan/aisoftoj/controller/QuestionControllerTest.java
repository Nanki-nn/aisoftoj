package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.common.ForbiddenException;
import com.nan.aisoftoj.dto.GetQuestionDetailDTO;
import com.nan.aisoftoj.service.AuthService;
import com.nan.aisoftoj.service.QuestionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.servlet.http.HttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuestionControllerTest {

    @Mock
    private QuestionService questionService;
    @Mock
    private AuthService authService;
    @Mock
    private HttpServletRequest request;
    @InjectMocks
    private QuestionController questionController;

    @Test
    void ordinaryQuestionReadRequiresOnlyAnAuthenticatedUser() {
        when(request.getHeader("Authorization")).thenReturn("Bearer user-token");
        when(questionService.getQuestionById(9, false)).thenReturn(new GetQuestionDetailDTO());

        questionController.getQuestionDetail(9, false, request);

        verify(authService).getCurrentUserId("Bearer user-token");
        verify(questionService).getQuestionById(9, false);
    }

    @Test
    void answerBearingQuestionReadRequiresAdministrator() {
        when(request.getHeader("Authorization")).thenReturn("Bearer admin-token");
        when(questionService.getQuestionById(9, true)).thenReturn(new GetQuestionDetailDTO());

        questionController.getQuestionDetail(9, true, request);

        verify(authService).requireAdmin("Bearer admin-token");
        verify(questionService).getQuestionById(9, true);
    }

    @Test
    void regularUserCannotReachAnswerBearingQuestionServiceCall() {
        when(request.getHeader("Authorization")).thenReturn("Bearer user-token");
        doThrow(new ForbiddenException("需要管理员权限"))
                .when(authService).requireAdmin("Bearer user-token");

        assertThrows(ForbiddenException.class,
                () -> questionController.getQuestionDetail(9, true, request));

        verifyNoInteractions(questionService);
    }
}
