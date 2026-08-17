package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.ai.AiInternalAuthenticator;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.dto.ai.AiProfileDTO;
import com.nan.aisoftoj.service.AiPlatformReadService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/internal/ai")
public class AiInternalController {

    private final AiInternalAuthenticator authenticator;
    private final AiPlatformReadService readService;

    public AiInternalController(
            AiInternalAuthenticator authenticator,
            AiPlatformReadService readService) {
        this.authenticator = authenticator;
        this.readService = readService;
    }

    @GetMapping("/me")
    public ResponseEntity<ResultDTO<AiProfileDTO>> getProfile(HttpServletRequest request) {
        Integer userId = authenticate(request);
        return noStore(ResultDTO.success(readService.getProfile(userId)));
    }

    private Integer authenticate(HttpServletRequest request) {
        return authenticator.authenticate(
                request.getHeader("X-AI-Service-Key"),
                request.getHeader("Authorization"));
    }

    private <T> ResponseEntity<ResultDTO<T>> noStore(ResultDTO<T> body) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore().cachePrivate())
                .body(body);
    }
}
