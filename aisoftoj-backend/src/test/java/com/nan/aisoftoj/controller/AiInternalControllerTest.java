package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.ai.AiInternalAuthenticator;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.dto.ai.AiProfileDTO;
import com.nan.aisoftoj.service.AiPlatformReadService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;

import javax.servlet.http.HttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiInternalControllerTest {

    @Mock
    private AiInternalAuthenticator authenticator;
    @Mock
    private AiPlatformReadService readService;
    @Mock
    private HttpServletRequest request;
    @InjectMocks
    private AiInternalController controller;

    @Test
    void profileRequiresBothCredentialsAndDisablesCaching() {
        AiProfileDTO profile = new AiProfileDTO();
        profile.setUserId(23);
        when(request.getHeader("X-AI-Service-Key")).thenReturn("service-key");
        when(request.getHeader("Authorization")).thenReturn("Bearer jwt");
        when(authenticator.authenticate("service-key", "Bearer jwt")).thenReturn(23);
        when(readService.getProfile(23)).thenReturn(profile);

        ResponseEntity<ResultDTO<AiProfileDTO>> response = controller.getProfile(request);

        assertEquals(200, response.getStatusCodeValue());
        assertEquals(CacheControl.noStore().cachePrivate().getHeaderValue(),
                response.getHeaders().getCacheControl());
        assertSame(profile, response.getBody().getData());
        verify(authenticator).authenticate("service-key", "Bearer jwt");
        verify(readService).getProfile(23);
    }

    @Test
    void assistantAvailabilityUsesAuthenticatedUser() {
        when(request.getHeader("X-AI-Service-Key")).thenReturn("service-key");
        when(request.getHeader("Authorization")).thenReturn("Bearer jwt");
        when(authenticator.authenticate("service-key", "Bearer jwt")).thenReturn(23);
        when(readService.isAiAssistantAvailable(23)).thenReturn(false);

        ResponseEntity<ResultDTO<Boolean>> response =
                controller.getAssistantAvailability(request);

        assertEquals(200, response.getStatusCodeValue());
        assertEquals(Boolean.FALSE, response.getBody().getData());
        verify(readService).isAiAssistantAvailable(23);
    }
}
