package com.nan.aisoftoj.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nan.aisoftoj.dto.AiChatMessageDTO;
import com.nan.aisoftoj.dto.AiChatSendRequest;
import com.nan.aisoftoj.dto.AiChatSessionDTO;
import com.nan.aisoftoj.dto.recommendation.KnowledgePointRecommendationDTO;
import com.nan.aisoftoj.dto.recommendation.WrongQuestionEvidenceDTO;
import com.nan.aisoftoj.entity.AiChatMessage;
import com.nan.aisoftoj.entity.AiChatSession;
import com.nan.aisoftoj.entity.AiChatSessionKnowledgeBase;
import com.nan.aisoftoj.mapper.AiChatSessionKnowledgeBaseMapper;
import com.nan.aisoftoj.mapper.AiChatMessageMapper;
import com.nan.aisoftoj.mapper.AiChatSessionMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import com.nan.aisoftoj.service.AiChatService;
import com.nan.aisoftoj.service.KnowledgeDocumentService;
import com.nan.aisoftoj.service.RecommendationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
public class AiChatServiceImpl implements AiChatService {
    private static final long STREAM_TIMEOUT = 180_000L;
    private static final int HISTORY_LIMIT = 12;

    @Autowired
    private AiChatSessionMapper sessionMapper;
    @Autowired
    private AiChatMessageMapper messageMapper;
    @Autowired
    private AiChatSessionKnowledgeBaseMapper sessionKnowledgeBaseMapper;
    @Autowired
    private UserWrongQuestionStatMapper wrongQuestionStatMapper;
    @Autowired
    private KnowledgeDocumentService knowledgeDocumentService;
    @Autowired
    private RecommendationService recommendationService;
    @Autowired
    private ObjectMapper objectMapper;

    @Value("${ai-service.url:http://localhost:8090}")
    private String aiServiceUrl;
    @Value("${ai-service.secret:}")
    private String aiServiceSecret;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AiChatSessionDTO createSession(Long userId) {
        AiChatSession session = new AiChatSession();
        session.setUserId(userId);
        session.setTitle("新对话");
        session.setCreateTime(LocalDateTime.now());
        session.setUpdateTime(LocalDateTime.now());
        session.setIsDeleted(0);
        sessionMapper.insert(session);
        for (com.nan.aisoftoj.dto.KnowledgeBaseDTO base
                : knowledgeDocumentService.listBases(userId)) {
            AiChatSessionKnowledgeBase relation = new AiChatSessionKnowledgeBase();
            relation.setSessionId(session.getId());
            relation.setKnowledgeBaseId(base.getId());
            sessionKnowledgeBaseMapper.insert(relation);
        }
        return toSessionDTO(session, Collections.emptyList());
    }

    @Override
    public List<AiChatSessionDTO> listSessions(Long userId) {
        List<AiChatSession> sessions = sessionMapper.selectList(
                new LambdaQueryWrapper<AiChatSession>()
                        .eq(AiChatSession::getUserId, userId)
                        .eq(AiChatSession::getIsDeleted, 0)
                        .orderByDesc(AiChatSession::getUpdateTime)
        );
        List<AiChatSessionDTO> result = new ArrayList<>();
        for (AiChatSession session : sessions) {
            result.add(toSessionDTO(session, null));
        }
        return result;
    }

    @Override
    public AiChatSessionDTO getSession(Long sessionId, Long userId) {
        AiChatSession session = requireOwnedSession(sessionId, userId);
        List<AiChatMessage> messages = messageMapper.selectList(
                new LambdaQueryWrapper<AiChatMessage>()
                        .eq(AiChatMessage::getSessionId, sessionId)
                        .orderByAsc(AiChatMessage::getCreateTime)
                        .orderByAsc(AiChatMessage::getId)
        );
        return toSessionDTO(session, messages);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteSession(Long sessionId, Long userId) {
        requireOwnedSession(sessionId, userId);
        sessionMapper.delete(new LambdaQueryWrapper<AiChatSession>()
                .eq(AiChatSession::getId, sessionId)
                .eq(AiChatSession::getUserId, userId));
        messageMapper.delete(new LambdaQueryWrapper<AiChatMessage>()
                .eq(AiChatMessage::getSessionId, sessionId));
        sessionKnowledgeBaseMapper.delete(new LambdaQueryWrapper<AiChatSessionKnowledgeBase>()
                .eq(AiChatSessionKnowledgeBase::getSessionId, sessionId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AiChatSessionDTO updateKnowledgeBases(
            Long sessionId, Long userId, List<Long> knowledgeBaseIds) {
        AiChatSession session = requireOwnedSession(sessionId, userId);
        List<Long> requested = knowledgeBaseIds == null
                ? Collections.emptyList() : knowledgeBaseIds;
        List<Long> owned = new ArrayList<>();
        for (com.nan.aisoftoj.dto.KnowledgeBaseDTO base
                : knowledgeDocumentService.listBases(userId)) {
            if (requested.contains(base.getId())) owned.add(base.getId());
        }
        if (owned.size() != requested.size()) {
            throw new IllegalArgumentException("包含无权访问的知识库");
        }
        sessionKnowledgeBaseMapper.delete(new LambdaQueryWrapper<AiChatSessionKnowledgeBase>()
                .eq(AiChatSessionKnowledgeBase::getSessionId, sessionId));
        for (Long baseId : owned) {
            AiChatSessionKnowledgeBase relation = new AiChatSessionKnowledgeBase();
            relation.setSessionId(sessionId);
            relation.setKnowledgeBaseId(baseId);
            sessionKnowledgeBaseMapper.insert(relation);
        }
        return toSessionDTO(session, null);
    }

    @Override
    public SseEmitter streamMessage(Long sessionId, Long userId, AiChatSendRequest request) {
        AiChatSession session = requireOwnedSession(sessionId, userId);
        List<AiChatMessage> history = recentCompletedMessages(sessionId);
        AiChatMessage userMessage = insertMessage(
                sessionId,
                "user",
                request.getQuestion().trim(),
                Boolean.TRUE.equals(request.getWebEnabled()),
                Boolean.TRUE.equals(request.getThinkingEnabled()),
                "completed"
        );
        AiChatMessage assistantMessage = insertMessage(
                sessionId,
                "assistant",
                "",
                Boolean.TRUE.equals(request.getWebEnabled()),
                Boolean.TRUE.equals(request.getThinkingEnabled()),
                "streaming"
        );
        updateSessionForMessage(session, userMessage.getContent());

        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT);
        sendQuietly(
                emitter,
                "status",
                singletonEvent("message", "问题已接收，正在连接 AI 助手")
        );
        CompletableFuture.runAsync(
                () -> proxyStream(userId, request, history, assistantMessage, emitter)
        );
        return emitter;
    }

    private void proxyStream(
            Long userId,
            AiChatSendRequest request,
            List<AiChatMessage> history,
            AiChatMessage assistantMessage,
            SseEmitter emitter) {
        StringBuilder answer = new StringBuilder();
        StringBuilder reasoning = new StringBuilder();
        List<Map<String, Object>> citations = new ArrayList<>();
        HttpURLConnection connection = null;
        try {
            URL endpoint = new URL(aiServiceUrl.replaceAll("/+$", "") + "/api/v1/chat/stream");
            connection = (HttpURLConnection) endpoint.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout((int) STREAM_TIMEOUT);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            connection.setRequestProperty("Accept", "text/event-stream");
            if (aiServiceSecret != null && !aiServiceSecret.isEmpty()) {
                connection.setRequestProperty("X-Aisoftoj-Internal-Secret", aiServiceSecret);
            }

            Map<String, Object> body = new HashMap<>();
            body.put("question", request.getQuestion().trim());
            body.put("user_id", String.valueOf(userId));
            body.put("session_id", String.valueOf(assistantMessage.getSessionId()));
            body.put(
                    "knowledge_base_ids",
                    knowledgeDocumentService.readyVectorIds(
                            userId,
                            selectedKnowledgeBaseIds(assistantMessage.getSessionId())
                    )
            );
            body.put("web_enabled", Boolean.TRUE.equals(request.getWebEnabled()));
            body.put("thinking_enabled", Boolean.TRUE.equals(request.getThinkingEnabled()));
            int rewriteCount = request.getRewriteCount() == null ? 3 : request.getRewriteCount();
            body.put("rewrite_count", Math.max(1, Math.min(rewriteCount, 5)));
            body.put("history", buildHistory(history));
            body.put("page_context", buildPageContext(userId));
            byte[] payload = objectMapper.writeValueAsBytes(body);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(payload);
            }

            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new IllegalStateException("AI 服务返回状态码 " + status);
            }

            readEvents(connection.getInputStream(), emitter, answer, reasoning, citations);
            completeAssistantMessage(
                    assistantMessage,
                    answer.toString(),
                    reasoning.toString(),
                    citations
            );
            emitter.complete();
        } catch (Exception exception) {
            failAssistantMessage(
                    assistantMessage,
                    answer.toString(),
                    reasoning.toString(),
                    exception.getMessage()
            );
            sendQuietly(
                    emitter,
                    "error",
                    singletonEvent("message", "问答服务暂时不可用，请稍后重试")
            );
            emitter.complete();
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private void readEvents(
            InputStream input,
            SseEmitter emitter,
            StringBuilder answer,
            StringBuilder reasoning,
            List<Map<String, Object>> citations) throws Exception {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String eventName = "message";
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("event:")) {
                    eventName = line.substring(6).trim();
                } else if (line.startsWith("data:")) {
                    Map<String, Object> data = objectMapper.readValue(
                            line.substring(5).trim(),
                            new TypeReference<Map<String, Object>>() {}
                    );
                    if ("token".equals(eventName)) {
                        Object content = data.get("content");
                        if (content != null) {
                            answer.append(content);
                        }
                    } else if ("reasoning".equals(eventName)) {
                        Object content = data.get("content");
                        if (content != null) {
                            reasoning.append(content);
                        }
                    } else if ("citation".equals(eventName)) {
                        citations.clear();
                        Object raw = data.get("citations");
                        if (raw instanceof List) {
                            citations.addAll((List<Map<String, Object>>) raw);
                        }
                    } else if ("error".equals(eventName)) {
                        throw new IllegalStateException(String.valueOf(data.get("message")));
                    }
                    emitter.send(SseEmitter.event().name(eventName).data(data));
                }
            }
        }
    }

    private List<Map<String, String>> buildHistory(List<AiChatMessage> messages) {
        List<Map<String, String>> history = new ArrayList<>();
        for (AiChatMessage message : messages) {
            Map<String, String> item = new HashMap<>();
            item.put("role", message.getRole());
            item.put("content", message.getContent());
            history.add(item);
        }
        return history;
    }

    private Map<String, Object> buildPageContext(Long userId) {
        Map<String, Object> context = new HashMap<>();
        try {
            Integer resolvedUserId = userId.intValue();
            List<WrongQuestionEvidenceDTO> evidences = wrongQuestionStatMapper
                    .selectRecommendationEvidence(resolvedUserId);
            List<KnowledgePointRecommendationDTO> recommendations = recommendationService
                    .listKnowledgePointRecommendations(resolvedUserId);
            context.put("wrong_question_evidences", evidences.size() > 30
                    ? evidences.subList(0, 30)
                    : evidences);
            context.put("knowledge_recommendations", recommendations);
        } catch (Exception exception) {
            context.put("context_error", exception.getMessage());
        }
        return context;
    }

    private List<AiChatMessage> recentCompletedMessages(Long sessionId) {
        List<AiChatMessage> messages = messageMapper.selectList(
                new LambdaQueryWrapper<AiChatMessage>()
                        .eq(AiChatMessage::getSessionId, sessionId)
                        .eq(AiChatMessage::getStatus, "completed")
                        .orderByDesc(AiChatMessage::getId)
                        .last("LIMIT " + HISTORY_LIMIT)
        );
        Collections.reverse(messages);
        return messages;
    }

    private AiChatMessage insertMessage(
            Long sessionId,
            String role,
            String content,
            boolean webEnabled,
            boolean thinkingEnabled,
            String status) {
        AiChatMessage message = new AiChatMessage();
        message.setSessionId(sessionId);
        message.setRole(role);
        message.setContent(content);
        message.setWebEnabled(webEnabled);
        message.setThinkingEnabled(thinkingEnabled);
        message.setReasoningContent("");
        message.setStatus(status);
        message.setCitations("[]");
        message.setCreateTime(LocalDateTime.now());
        message.setUpdateTime(LocalDateTime.now());
        messageMapper.insert(message);
        return message;
    }

    private void updateSessionForMessage(AiChatSession session, String question) {
        if ("新对话".equals(session.getTitle())) {
            String normalized = question.replaceAll("\\s+", " ").trim();
            session.setTitle(
                    normalized.length() > 24 ? normalized.substring(0, 24) : normalized
            );
        }
        session.setUpdateTime(LocalDateTime.now());
        sessionMapper.updateById(session);
    }

    private void completeAssistantMessage(
            AiChatMessage message,
            String content,
            String reasoningContent,
            List<Map<String, Object>> citations) throws Exception {
        message.setContent(content);
        message.setReasoningContent(reasoningContent);
        message.setStatus("completed");
        message.setCitations(objectMapper.writeValueAsString(citations));
        message.setErrorMessage(null);
        message.setUpdateTime(LocalDateTime.now());
        messageMapper.updateById(message);
    }

    private void failAssistantMessage(
            AiChatMessage message,
            String content,
            String reasoningContent,
            String error) {
        message.setContent(content);
        message.setReasoningContent(reasoningContent);
        message.setStatus("failed");
        message.setErrorMessage(error);
        message.setUpdateTime(LocalDateTime.now());
        messageMapper.updateById(message);
    }

    private AiChatSession requireOwnedSession(Long sessionId, Long userId) {
        AiChatSession session = sessionMapper.selectOne(
                new LambdaQueryWrapper<AiChatSession>()
                        .eq(AiChatSession::getId, sessionId)
                        .eq(AiChatSession::getUserId, userId)
                        .eq(AiChatSession::getIsDeleted, 0)
                        .last("LIMIT 1")
        );
        if (session == null) {
            throw new IllegalArgumentException("对话不存在或无权访问");
        }
        return session;
    }

    private AiChatSessionDTO toSessionDTO(
            AiChatSession session,
            List<AiChatMessage> messages) {
        AiChatSessionDTO dto = new AiChatSessionDTO();
        dto.setId(session.getId());
        dto.setTitle(session.getTitle());
        dto.setCreateTime(session.getCreateTime());
        dto.setUpdateTime(session.getUpdateTime());
        dto.setKnowledgeBaseIds(selectedKnowledgeBaseIds(session.getId()));
        if (messages != null) {
            List<AiChatMessageDTO> messageDTOs = new ArrayList<>();
            for (AiChatMessage message : messages) {
                messageDTOs.add(toMessageDTO(message));
            }
            dto.setMessages(messageDTOs);
        }
        return dto;
    }

    private List<Long> selectedKnowledgeBaseIds(Long sessionId) {
        List<Long> result = new ArrayList<>();
        for (AiChatSessionKnowledgeBase relation : sessionKnowledgeBaseMapper.selectList(
                new LambdaQueryWrapper<AiChatSessionKnowledgeBase>()
                        .eq(AiChatSessionKnowledgeBase::getSessionId, sessionId))) {
            result.add(relation.getKnowledgeBaseId());
        }
        return result;
    }

    private AiChatMessageDTO toMessageDTO(AiChatMessage message) {
        AiChatMessageDTO dto = new AiChatMessageDTO();
        dto.setId(message.getId());
        dto.setRole(message.getRole());
        dto.setContent(message.getContent());
        dto.setWebEnabled(message.getWebEnabled());
        dto.setThinkingEnabled(message.getThinkingEnabled());
        dto.setReasoningContent(message.getReasoningContent());
        dto.setStatus(message.getStatus());
        dto.setErrorMessage(message.getErrorMessage());
        dto.setCreateTime(message.getCreateTime());
        try {
            dto.setCitations(objectMapper.readValue(
                    message.getCitations() == null ? "[]" : message.getCitations(),
                    new TypeReference<List<Map<String, Object>>>() {}
            ));
        } catch (Exception ignored) {
            dto.setCitations(Collections.emptyList());
        }
        return dto;
    }

    private Map<String, Object> singletonEvent(String key, Object value) {
        Map<String, Object> event = new HashMap<>();
        event.put(key, value);
        return event;
    }

    private void sendQuietly(SseEmitter emitter, String event, Map<String, Object> data) {
        try {
            emitter.send(SseEmitter.event().name(event).data(data));
        } catch (Exception ignored) {
            // The browser may have already aborted the stream.
        }
    }
}
