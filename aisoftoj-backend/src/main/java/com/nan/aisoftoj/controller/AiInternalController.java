package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.ai.AiInternalAuthenticator;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.dto.ai.AiProfileDTO;
import com.nan.aisoftoj.dto.ai.AiPaperDTO;
import com.nan.aisoftoj.dto.ai.AiQuestionDTO;
import com.nan.aisoftoj.dto.ai.AiPracticeHistoryPageDTO;
import com.nan.aisoftoj.dto.ai.AiWrongQuestionReviewDTO;
import com.nan.aisoftoj.service.AiPlatformReadService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

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

    @GetMapping("/papers")
    public ResponseEntity<ResultDTO<List<AiPaperDTO>>> listPapers(HttpServletRequest request) {
        Integer userId = authenticate(request);
        return noStore(ResultDTO.success(readService.listPapers(userId)));
    }

    @GetMapping("/questions/{questionId}")
    public ResponseEntity<ResultDTO<AiQuestionDTO>> getQuestion(
            @PathVariable Integer questionId,
            HttpServletRequest request) {
        authenticate(request);
        return noStore(ResultDTO.success(readService.getQuestion(questionId)));
    }

    @GetMapping("/wrong-questions/{wrongQuestionId}/review")
    public ResponseEntity<ResultDTO<AiWrongQuestionReviewDTO>> reviewWrongQuestion(
            @PathVariable Long wrongQuestionId,
            HttpServletRequest request) {
        Integer userId = authenticate(request);
        return noStore(ResultDTO.success(
                readService.reviewWrongQuestion(userId, wrongQuestionId)));
    }

    @GetMapping("/practice-history")
    public ResponseEntity<ResultDTO<AiPracticeHistoryPageDTO>> listPracticeHistory(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            HttpServletRequest request) {
        Integer userId = authenticate(request);
        return noStore(ResultDTO.success(
                readService.listPracticeHistory(userId, page, pageSize)));
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
