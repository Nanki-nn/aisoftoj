package com.nan.aisoftoj.common;

import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.context.request.WebRequest;

import javax.servlet.http.HttpServletRequest;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseBody
    public ErrorResponse handleIllegalArgumentException(HttpServletRequest request, IllegalArgumentException ex) {
        return new ErrorResponse(400, ex.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler(Exception.class)
    @ResponseBody
    public ErrorResponse handleGeneralException(HttpServletRequest request, Exception ex) {
        return new ErrorResponse(500, "服务器内部错误", request.getRequestURI());
    }
}