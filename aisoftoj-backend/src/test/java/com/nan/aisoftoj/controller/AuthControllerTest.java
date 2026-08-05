package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.AuthResponse;
import com.nan.aisoftoj.dto.WeChatLoginRequest;
import com.nan.aisoftoj.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthControllerTest {

    @Test
    void wechatLoginForwardsTrustedClientIpAndTemporaryCode() {
        AuthService authService = mock(AuthService.class);
        AuthController controller = new AuthController();
        ReflectionTestUtils.setField(controller, "authService", authService);
        WeChatLoginRequest request = new WeChatLoginRequest();
        request.setCode("temporary-code");
        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        servletRequest.addHeader("X-Real-IP", "203.0.113.8");
        when(authService.loginByWechat(request, "203.0.113.8"))
                .thenReturn(new AuthResponse());

        controller.loginByWechat(request, servletRequest);

        verify(authService).loginByWechat(request, "203.0.113.8");
    }
}
