package com.nan.aisoftoj.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;

import javax.servlet.http.HttpServletRequest;

@ControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseBody
    public ErrorResponse handleIllegalArgumentException(HttpServletRequest request, IllegalArgumentException ex) {
        return new ErrorResponse(400, ex.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseBody
    public ErrorResponse handleMethodArgumentNotValidException(HttpServletRequest request, MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().isEmpty()
                ? "请求参数不合法"
                : ex.getBindingResult().getFieldErrors().get(0).getDefaultMessage();
        return new ErrorResponse(400, message, request.getRequestURI());
    }

    @ExceptionHandler(UnauthorizedException.class)
    @ResponseBody
    public ErrorResponse handleUnauthorizedException(HttpServletRequest request, UnauthorizedException ex) {
        return new ErrorResponse(401, ex.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler(ForbiddenException.class)
    @ResponseBody
    public ErrorResponse handleForbiddenException(HttpServletRequest request, ForbiddenException ex) {
        return new ErrorResponse(403, ex.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler(Exception.class)
    @ResponseBody
    public ErrorResponse handleGeneralException(HttpServletRequest request, Exception ex) {
        log.error("Unhandled request exception: {}", request.getRequestURI(), ex);
        return new ErrorResponse(500, "服务器内部错误", request.getRequestURI());
    }
}
