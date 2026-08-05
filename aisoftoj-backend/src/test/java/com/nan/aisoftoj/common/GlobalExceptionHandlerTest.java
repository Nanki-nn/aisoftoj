package com.nan.aisoftoj.common;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void mapsConflictExceptionToHttp409() {
        MockHttpServletRequest request = new MockHttpServletRequest("PATCH", "/session/12");

        ResponseEntity<ErrorResponse> response = handler.handleConflictException(
                request,
                new ConflictException("会话状态冲突"));

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals(409, response.getBody().getCode());
        assertEquals("会话状态冲突", response.getBody().getMessage());
        assertEquals("/session/12", response.getBody().getPath());
    }
}
