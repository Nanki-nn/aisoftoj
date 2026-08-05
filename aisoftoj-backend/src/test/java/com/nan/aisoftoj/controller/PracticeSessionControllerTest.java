package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.GETPracticeSessionRes;
import com.nan.aisoftoj.service.AuthService;
import com.nan.aisoftoj.service.PracticeSessionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.servlet.http.HttpServletRequest;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PracticeSessionControllerTest {

    @Mock
    private PracticeSessionService practiceSessionService;
    @Mock
    private AuthService authService;
    @Mock
    private HttpServletRequest request;
    @InjectMocks
    private PracticeSessionController practiceSessionController;

    @Test
    void resultEndpointUsesAuthenticatedUserOwnershipBoundary() {
        when(request.getHeader("Authorization")).thenReturn("Bearer user-token");
        when(authService.getCurrentUserId("Bearer user-token")).thenReturn(7);
        when(practiceSessionService.getPracticeSessionResult(7, 12))
                .thenReturn(new GETPracticeSessionRes());

        practiceSessionController.getPracticeSessionResult(12, request);

        verify(authService).getCurrentUserId("Bearer user-token");
        verify(practiceSessionService).getPracticeSessionResult(7, 12);
    }
}
