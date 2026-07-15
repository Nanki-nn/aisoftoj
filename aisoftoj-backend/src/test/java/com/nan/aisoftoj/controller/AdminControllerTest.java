package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.common.ForbiddenException;
import com.nan.aisoftoj.service.AdminService;
import com.nan.aisoftoj.service.AuthService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.servlet.http.HttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminControllerTest {

    @Mock
    private AdminService adminService;

    @Mock
    private AuthService authService;

    @Mock
    private HttpServletRequest request;

    @InjectMocks
    private AdminController adminController;

    @Test
    void authorizationRunsBeforeAdminBusinessService() {
        when(request.getHeader("Authorization")).thenReturn("Bearer regular-user-token");
        doThrow(new ForbiddenException("需要管理员权限"))
                .when(authService).requireAdmin("Bearer regular-user-token");

        assertThrows(ForbiddenException.class, () -> adminController.dashboard(request));
        verifyNoInteractions(adminService);
    }
}
