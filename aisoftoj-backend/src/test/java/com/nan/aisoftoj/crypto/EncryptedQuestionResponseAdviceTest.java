package com.nan.aisoftoj.crypto;

import com.nan.aisoftoj.dto.ResultDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.lang.reflect.Method;
import java.security.PublicKey;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EncryptedQuestionResponseAdviceTest {

    @Mock
    private QuestionContentEncryptionService encryptionService;
    @Mock
    private PublicKey publicKey;

    private EncryptedQuestionResponseAdvice advice;
    private MethodParameter returnType;

    @BeforeEach
    void setUp() throws Exception {
        advice = new EncryptedQuestionResponseAdvice(encryptionService);
        Method method = TestController.class.getDeclaredMethod("encrypted");
        returnType = new MethodParameter(method, -1);
    }

    @Test
    void encryptsSuccessBeforeSettingHeaders() {
        ResultDTO<String> body = ResultDTO.success("secret");
        EncryptedContentResponse encrypted = new EncryptedContentResponse(
                1, ContentCryptoHeaders.ALGORITHM, "key", "iv", "ciphertext");
        Exchange exchange = exchangeWithKey();
        when(encryptionService.encrypt(body, publicKey)).thenReturn(encrypted);

        Object result = advice.beforeBodyWrite(
                body,
                returnType,
                MediaType.APPLICATION_JSON,
                MappingJackson2HttpMessageConverter.class,
                exchange.request,
                exchange.response);

        assertSame(encrypted, result);
        assertEquals("1", exchange.response.getHeaders().getFirst(
                ContentCryptoHeaders.RESPONSE_ENCRYPTED));
        assertEquals("private, no-store", exchange.response.getHeaders().getCacheControl());
    }

    @Test
    void leavesInBandBusinessErrorPlain() {
        ResultDTO<String> body = ResultDTO.error(429, "请求过于频繁");
        Exchange exchange = exchangeWithKey();

        Object result = advice.beforeBodyWrite(
                body,
                returnType,
                MediaType.APPLICATION_JSON,
                MappingJackson2HttpMessageConverter.class,
                exchange.request,
                exchange.response);

        assertSame(body, result);
        assertNull(exchange.response.getHeaders().getFirst(ContentCryptoHeaders.RESPONSE_ENCRYPTED));
        verifyNoInteractions(encryptionService);
    }

    @Test
    void encryptionFailureDoesNotSetMarker() {
        ResultDTO<String> body = ResultDTO.success("secret");
        Exchange exchange = exchangeWithKey();
        when(encryptionService.encrypt(body, publicKey))
                .thenThrow(new ContentEncryptionException("failed"));

        assertThrows(ContentEncryptionException.class, () -> advice.beforeBodyWrite(
                body,
                returnType,
                MediaType.APPLICATION_JSON,
                MappingJackson2HttpMessageConverter.class,
                exchange.request,
                exchange.response));
        assertNull(exchange.response.getHeaders().getFirst(ContentCryptoHeaders.RESPONSE_ENCRYPTED));
    }

    private Exchange exchangeWithKey() {
        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        servletRequest.setAttribute(ContentCryptoHeaders.REQUEST_PUBLIC_KEY_ATTRIBUTE, publicKey);
        MockHttpServletResponse servletResponse = new MockHttpServletResponse();
        return new Exchange(
                new ServletServerHttpRequest(servletRequest),
                new ServletServerHttpResponse(servletResponse),
                servletResponse);
    }

    private static class Exchange {
        private final ServletServerHttpRequest request;
        private final ServletServerHttpResponse response;
        private final MockHttpServletResponse servletResponse;

        private Exchange(
                ServletServerHttpRequest request,
                ServletServerHttpResponse response,
                MockHttpServletResponse servletResponse) {
            this.request = request;
            this.response = response;
            this.servletResponse = servletResponse;
        }
    }

    private static class TestController {
        @EncryptedQuestionResponse
        public ResultDTO<String> encrypted() {
            return ResultDTO.success("secret");
        }
    }
}
