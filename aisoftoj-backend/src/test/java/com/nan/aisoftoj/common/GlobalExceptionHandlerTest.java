package com.nan.aisoftoj.common;

import com.nan.aisoftoj.dto.QuestionRecordUpdateResponse;
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

    @Test
    void revisionConflictIncludesTheCurrentServerRecord() {
        MockHttpServletRequest request = new MockHttpServletRequest("PATCH", "/question-record/30");
        QuestionRecordUpdateResponse currentState = new QuestionRecordUpdateResponse();
        currentState.setRecordId(30);
        currentState.setAnswerRevision(4L);
        currentState.setUserAnswer("C");

        ResponseEntity<ErrorResponse> response = handler.handleAnswerRevisionConflictException(
                request,
                new AnswerRevisionConflictException("答案版本冲突", currentState));

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals(currentState, response.getBody().getData());
    }

    @Test
    void mapsUnprocessableAnswerToHttp422() {
        MockHttpServletRequest request = new MockHttpServletRequest("PATCH", "/question-record/30");

        ResponseEntity<ErrorResponse> response = handler.handleUnprocessableEntityException(
                request,
                new UnprocessableEntityException("单题答案不能超过 10000 个字符"));

        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, response.getStatusCode());
        assertEquals(422, response.getBody().getCode());
    }
}
