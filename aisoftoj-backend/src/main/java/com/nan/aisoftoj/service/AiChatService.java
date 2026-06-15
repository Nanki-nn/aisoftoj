package com.nan.aisoftoj.service;

import com.nan.aisoftoj.dto.AiChatSendRequest;
import com.nan.aisoftoj.dto.AiChatSessionDTO;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

public interface AiChatService {
    AiChatSessionDTO createSession(Long userId);
    List<AiChatSessionDTO> listSessions(Long userId);
    AiChatSessionDTO getSession(Long sessionId, Long userId);
    void deleteSession(Long sessionId, Long userId);
    AiChatSessionDTO updateKnowledgeBases(Long sessionId, Long userId, List<Long> knowledgeBaseIds);
    SseEmitter streamMessage(Long sessionId, Long userId, AiChatSendRequest request);
}
