package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.AiChatSendRequest;
import com.nan.aisoftoj.dto.AiChatSessionDTO;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.service.AiChatService;
import com.nan.aisoftoj.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/ai/chat")
public class AiChatController {
    @Autowired
    private AiChatService aiChatService;
    @Autowired
    private AuthService authService;

    @PostMapping("/sessions")
    public ResultDTO<AiChatSessionDTO> createSession(HttpServletRequest request) {
        return ResultDTO.success(aiChatService.createSession(currentUserId(request)));
    }

    @GetMapping("/sessions")
    public ResultDTO<List<AiChatSessionDTO>> listSessions(HttpServletRequest request) {
        return ResultDTO.success(aiChatService.listSessions(currentUserId(request)));
    }

    @GetMapping("/sessions/{sessionId}")
    public ResultDTO<AiChatSessionDTO> getSession(
            @PathVariable Long sessionId,
            HttpServletRequest request) {
        return ResultDTO.success(aiChatService.getSession(sessionId, currentUserId(request)));
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResultDTO<Void> deleteSession(
            @PathVariable Long sessionId,
            HttpServletRequest request) {
        aiChatService.deleteSession(sessionId, currentUserId(request));
        return ResultDTO.success();
    }

    @PutMapping("/sessions/{sessionId}/knowledge-bases")
    public ResultDTO<AiChatSessionDTO> updateKnowledgeBases(
            @PathVariable Long sessionId,
            @RequestBody Map<String, List<Long>> body,
            HttpServletRequest request) {
        return ResultDTO.success(aiChatService.updateKnowledgeBases(
                sessionId,
                currentUserId(request),
                body.get("knowledgeBaseIds")
        ));
    }

    @PostMapping(
            value = "/sessions/{sessionId}/messages/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter streamMessage(
            @PathVariable Long sessionId,
            @Validated @RequestBody AiChatSendRequest body,
            HttpServletRequest request) {
        return aiChatService.streamMessage(sessionId, currentUserId(request), body);
    }

    private Long currentUserId(HttpServletRequest request) {
        return Long.valueOf(authService.getCurrentUserId(request.getHeader("Authorization")));
    }
}
