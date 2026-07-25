package com.nan.aisoftoj.crypto;

import com.nan.aisoftoj.dto.ResultDTO;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

import javax.servlet.http.HttpServletRequest;
import java.security.PublicKey;

@ControllerAdvice
public class EncryptedQuestionResponseAdvice implements ResponseBodyAdvice<Object> {

    private final QuestionContentEncryptionService encryptionService;

    public EncryptedQuestionResponseAdvice(QuestionContentEncryptionService encryptionService) {
        this.encryptionService = encryptionService;
    }

    @Override
    public boolean supports(
            MethodParameter returnType,
            Class<? extends HttpMessageConverter<?>> converterType) {
        return returnType.hasMethodAnnotation(EncryptedQuestionResponse.class);
    }

    @Override
    public Object beforeBodyWrite(
            Object body,
            MethodParameter returnType,
            MediaType selectedContentType,
            Class<? extends HttpMessageConverter<?>> selectedConverterType,
            ServerHttpRequest request,
            ServerHttpResponse response) {
        if (!isSuccessfulHttpResponse(response)) {
            return body;
        }
        if (!(body instanceof ResultDTO)) {
            throw new ContentEncryptionException("题目数据响应格式不合法");
        }

        ResultDTO<?> result = (ResultDTO<?>) body;
        if (!Integer.valueOf(200).equals(result.getCode())) {
            return body;
        }
        if (!(request instanceof ServletServerHttpRequest)) {
            throw new ContentEncryptionException("题目数据请求上下文不合法");
        }

        HttpServletRequest servletRequest = ((ServletServerHttpRequest) request).getServletRequest();
        Object keyAttribute = servletRequest.getAttribute(
                ContentCryptoHeaders.REQUEST_PUBLIC_KEY_ATTRIBUTE);
        if (!(keyAttribute instanceof PublicKey)) {
            throw new ContentEncryptionException("题目数据加密公钥缺失");
        }

        EncryptedContentResponse encrypted = encryptionService.encrypt(body, (PublicKey) keyAttribute);
        response.getHeaders().set(ContentCryptoHeaders.RESPONSE_ENCRYPTED,
                ContentCryptoHeaders.PROTOCOL_VERSION);
        response.getHeaders().setCacheControl("private, no-store");
        return encrypted;
    }

    private boolean isSuccessfulHttpResponse(ServerHttpResponse response) {
        if (!(response instanceof ServletServerHttpResponse)) {
            return true;
        }
        int status = ((ServletServerHttpResponse) response).getServletResponse().getStatus();
        return status >= 200 && status < 300;
    }
}
