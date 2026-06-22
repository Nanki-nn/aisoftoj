package com.nan.aisoftoj.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nan.aisoftoj.dto.recommendation.KnowledgeGraphAgentDTO;
import com.nan.aisoftoj.dto.recommendation.KnowledgeGraphDTO;
import com.nan.aisoftoj.dto.recommendation.KnowledgeGraphEdgeUpdateRequest;
import com.nan.aisoftoj.dto.recommendation.KnowledgeGraphNodeUpdateRequest;
import com.nan.aisoftoj.dto.recommendation.KnowledgePointRecommendationDTO;
import com.nan.aisoftoj.dto.recommendation.StudyRoadmapDTO;
import com.nan.aisoftoj.dto.recommendation.StudyRoadmapRequest;
import com.nan.aisoftoj.dto.recommendation.WrongQuestionEvidenceDTO;
import com.nan.aisoftoj.entity.KnowledgeDocument;
import com.nan.aisoftoj.mapper.KnowledgeDocumentMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import com.nan.aisoftoj.service.RecommendationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class RecommendationServiceImpl implements RecommendationService {
    private final UserWrongQuestionStatMapper wrongQuestionStatMapper;
    private final KnowledgeDocumentMapper knowledgeDocumentMapper;
    private final Neo4jRecommendationGraphClient graphClient;
    private final ObjectMapper objectMapper;

    @Value("${ai-service.url:http://localhost:8090}")
    private String aiServiceUrl;

    @Value("${ai-service.secret:}")
    private String aiServiceSecret;

    public RecommendationServiceImpl(
            UserWrongQuestionStatMapper wrongQuestionStatMapper,
            KnowledgeDocumentMapper knowledgeDocumentMapper,
            Neo4jRecommendationGraphClient graphClient,
            ObjectMapper objectMapper) {
        this.wrongQuestionStatMapper = wrongQuestionStatMapper;
        this.knowledgeDocumentMapper = knowledgeDocumentMapper;
        this.graphClient = graphClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public List<KnowledgePointRecommendationDTO> listKnowledgePointRecommendations(Integer userId) {
        List<WrongQuestionEvidenceDTO> evidences = wrongQuestionStatMapper.selectRecommendationEvidence(userId);
        return buildRecommendations(evidences, 8);
    }

    @Override
    public KnowledgeGraphDTO getKnowledgeGraph(Integer userId, String scope) {
        List<WrongQuestionEvidenceDTO> evidences = wrongQuestionStatMapper.selectRecommendationEvidence(userId);
        if ("full".equalsIgnoreCase(scope)) {
            if (!evidences.isEmpty()) {
                graphClient.syncWrongQuestionEvidence(userId, evidences);
            }
            return graphClient.loadUserFullGraph(userId);
        }
        if (evidences.isEmpty()) {
            KnowledgeGraphDTO graph = new KnowledgeGraphDTO();
            graph.setGraphAvailable(false);
            graph.setSource("no_wrong_question_evidence");
            return graph;
        }
        graphClient.syncWrongQuestionEvidence(userId, evidences);
        KnowledgeGraphDTO existingGraph = graphClient.loadUserWeakGraph(userId);
        if (!existingGraph.getNodes().isEmpty()) {
            return existingGraph;
        }
        graphClient.rebuildUserGraph(
                userId,
                evidences,
                requestKnowledgeGraphAgent(
                        buildRecommendations(evidences, 12),
                        evidences,
                        readyKnowledgeBaseIds(userId)));
        return graphClient.loadUserWeakGraph(userId);
    }

    @Override
    public KnowledgeGraphDTO updateKnowledgeGraphNode(
            Integer userId,
            String nodeId,
            KnowledgeGraphNodeUpdateRequest request) {
        graphClient.updateKnowledgeNode(userId, nodeId, request.getLabel());
        return graphClient.loadUserWeakGraph(userId);
    }

    @Override
    public KnowledgeGraphDTO updateKnowledgeGraphEdge(
            Integer userId,
            String edgeId,
            KnowledgeGraphEdgeUpdateRequest request) {
        graphClient.updateKnowledgeEdge(
                userId,
                edgeId,
                request.getType(),
                request.getLabel(),
                request.getWeight());
        return graphClient.loadUserWeakGraph(userId);
    }

    @Override
    public KnowledgeGraphDTO deleteKnowledgeGraphEdge(Integer userId, String edgeId) {
        graphClient.deleteKnowledgeEdge(userId, edgeId);
        return graphClient.loadUserWeakGraph(userId);
    }

    @Override
    public StudyRoadmapDTO generateStudyRoadmap(Integer userId, StudyRoadmapRequest request) {
        int days = request == null || request.getDays() == null ? 7 : request.getDays();
        if (days != 14) {
            days = 7;
        }
        int dailyMinutes = request == null || request.getDailyMinutes() == null
                ? 60
                : Math.max(20, Math.min(request.getDailyMinutes(), 180));
        List<WrongQuestionEvidenceDTO> evidences = wrongQuestionStatMapper.selectRecommendationEvidence(userId);
        List<KnowledgePointRecommendationDTO> recommendations = buildRecommendations(evidences, 12);
        return requestRoadmapAgent(days, dailyMinutes, recommendations);
    }

    private List<WrongQuestionEvidenceDTO> loadAndSyncEvidence(Integer userId) {
        List<WrongQuestionEvidenceDTO> evidences = wrongQuestionStatMapper.selectRecommendationEvidence(userId);
        if (evidences.isEmpty()) {
            return evidences;
        }
        List<KnowledgePointRecommendationDTO> recommendations = buildRecommendations(evidences, 12);
        KnowledgeGraphAgentDTO agentGraph = requestKnowledgeGraphAgent(
                recommendations,
                evidences,
                readyKnowledgeBaseIds(userId));
        graphClient.rebuildUserGraph(userId, evidences, agentGraph);
        return evidences;
    }

    private List<String> readyKnowledgeBaseIds(Integer userId) {
        Set<String> ids = new LinkedHashSet<>();
        List<KnowledgeDocument> documents = knowledgeDocumentMapper.selectList(
                new LambdaQueryWrapper<KnowledgeDocument>()
                        .eq(KnowledgeDocument::getUserId, Long.valueOf(userId))
                        .eq(KnowledgeDocument::getStatus, "ready"));
        for (KnowledgeDocument document : documents) {
            if (document.getKnowledgeBaseId() != null && !document.getKnowledgeBaseId().trim().isEmpty()) {
                ids.add(document.getKnowledgeBaseId().trim());
            }
        }
        return new ArrayList<>(ids);
    }

    private KnowledgeGraphAgentDTO requestKnowledgeGraphAgent(
            List<KnowledgePointRecommendationDTO> recommendations,
            List<WrongQuestionEvidenceDTO> evidences,
            List<String> knowledgeBaseIds) {
        try {
            URL endpoint = new URL(aiServiceUrl.replaceAll("/+$", "")
                    + "/api/v1/recommendations/knowledge-graph");
            HttpURLConnection connection = (HttpURLConnection) endpoint.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(120_000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            if (aiServiceSecret != null && !aiServiceSecret.isEmpty()) {
                connection.setRequestProperty("X-Aisoftoj-Internal-Secret", aiServiceSecret);
            }
            Map<String, Object> body = new HashMap<>();
            body.put("recommendations", recommendations);
            body.put("evidences", evidences);
            body.put("knowledge_base_ids", knowledgeBaseIds);
            body.put("max_nodes", 56);
            body.put("max_edges", 96);
            byte[] payload = objectMapper.writeValueAsBytes(body);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(payload);
            }
            if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) {
                throw new IllegalStateException("AI service returned " + connection.getResponseCode());
            }
            try (InputStream input = connection.getInputStream()) {
                return objectMapper.readValue(input, KnowledgeGraphAgentDTO.class);
            }
        } catch (Exception exception) {
            throw new IllegalStateException("知识图谱 Agent 暂时不可用: " + exception.getMessage(), exception);
        }
    }

    private List<KnowledgePointRecommendationDTO> buildRecommendations(
            List<WrongQuestionEvidenceDTO> evidences,
            int limit) {
        Map<String, KnowledgePointRecommendationDTO> grouped = new LinkedHashMap<>();
        for (WrongQuestionEvidenceDTO evidence : evidences) {
            String knowledgeName = firstNonBlank(evidence.getKnowledgePointName(), evidence.getQuestionName(), "未归类知识点");
            String id = "kp:" + firstNonBlank(evidence.getSubjectName(), "通用") + ":" + knowledgeName;
            KnowledgePointRecommendationDTO item = grouped.get(id);
            if (item == null) {
                item = new KnowledgePointRecommendationDTO();
                item.setId(id);
                item.setName(knowledgeName);
                item.setSubject(firstNonBlank(evidence.getSubjectName(), "通用"));
                item.setCategory(knowledgeName);
                item.setScore(0);
                item.setErrorCount(0);
                item.setWrongQuestionCount(0);
                item.setEvidences(new ArrayList<>());
                grouped.put(id, item);
            }
            int errorCount = evidence.getErrorCount() == null ? 1 : evidence.getErrorCount();
            item.setErrorCount(item.getErrorCount() + errorCount);
            item.setWrongQuestionCount(item.getWrongQuestionCount() + 1);
            item.setScore(item.getScore() + scoreEvidence(evidence));
            item.getEvidences().add(evidence);
        }
        List<KnowledgePointRecommendationDTO> result = new ArrayList<>(grouped.values());
        result.sort(Comparator.comparing(KnowledgePointRecommendationDTO::getScore).reversed());
        if (result.size() > limit) {
            result = new ArrayList<>(result.subList(0, limit));
        }
        int minRawScore = result.stream()
                .mapToInt(KnowledgePointRecommendationDTO::getScore)
                .min()
                .orElse(0);
        int maxRawScore = result.stream()
                .mapToInt(KnowledgePointRecommendationDTO::getScore)
                .max()
                .orElse(0);
        for (KnowledgePointRecommendationDTO item : result) {
            int normalizedScore = normalizeRecommendationScore(item.getScore(), minRawScore, maxRawScore);
            item.setScore(normalizedScore);
            item.setMastery(estimateMastery(normalizedScore, item.getWrongQuestionCount()));
            item.setLevel(resolveLevel(item.getScore()));
            item.setReason("该知识点命中 " + item.getWrongQuestionCount()
                    + " 道错题，累计错误 " + item.getErrorCount() + " 次。");
            item.setSuggestion("先回看关联错题，再按前置概念、核心概念、同类题三步复习。");
        }
        return result;
    }

    private StudyRoadmapDTO requestRoadmapAgent(
            int days,
            int dailyMinutes,
            List<KnowledgePointRecommendationDTO> recommendations) {
        try {
            URL endpoint = new URL(aiServiceUrl.replaceAll("/+$", "")
                    + "/api/v1/recommendations/study-roadmap");
            HttpURLConnection connection = (HttpURLConnection) endpoint.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(60_000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            if (aiServiceSecret != null && !aiServiceSecret.isEmpty()) {
                connection.setRequestProperty("X-Aisoftoj-Internal-Secret", aiServiceSecret);
            }
            Map<String, Object> body = new HashMap<>();
            body.put("days", days);
            body.put("daily_minutes", dailyMinutes);
            body.put("recommendations", recommendations);
            byte[] payload = objectMapper.writeValueAsBytes(body);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(payload);
            }
            if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) {
                throw new IllegalStateException("AI service returned " + connection.getResponseCode());
            }
            try (InputStream input = connection.getInputStream()) {
                return objectMapper.readValue(input, StudyRoadmapDTO.class);
            }
        } catch (Exception exception) {
            throw new IllegalStateException("学习路线 Agent 暂时不可用: " + exception.getMessage(), exception);
        }
    }

    private int scoreEvidence(WrongQuestionEvidenceDTO evidence) {
        int errorCount = Math.max(1, evidence.getErrorCount() == null ? 1 : evidence.getErrorCount());
        int difficulty = Math.max(1, evidence.getDifficulty() == null ? 2 : evidence.getDifficulty());
        int score = 10 + (int) Math.round(Math.log1p(errorCount) * 12 + Math.sqrt(errorCount) * 4);
        score += difficulty * 4;
        String importance = evidence.getImportanceLevel();
        if ("must".equals(importance)) score += 14;
        else if ("high".equals(importance)) score += 10;
        else if ("medium".equals(importance)) score += 6;
        return score;
    }

    private int normalizeRecommendationScore(int rawScore, int minRawScore, int maxRawScore) {
        if (maxRawScore <= 0) {
            return 0;
        }
        if (maxRawScore == minRawScore) {
            return Math.max(45, Math.min(85, rawScore));
        }
        double ratio = (rawScore - minRawScore) * 1.0 / (maxRawScore - minRawScore);
        return (int) Math.round(42 + ratio * 58);
    }

    private int estimateMastery(int score, int wrongQuestionCount) {
        int penalty = Math.min(12, Math.max(0, wrongQuestionCount));
        int mastery = (int) Math.round(92 - score * 0.68 - penalty);
        return Math.max(12, Math.min(88, mastery));
    }

    private String resolveLevel(int score) {
        if (score >= 85) return "must";
        if (score >= 68) return "high";
        if (score >= 48) return "medium";
        return "low";
    }

    private String firstNonBlank(String first, String second, String defaultValue) {
        if (first != null && !first.trim().isEmpty()) return first.trim();
        if (second != null && !second.trim().isEmpty()) return second.trim();
        return defaultValue;
    }

    private String firstNonBlank(String first, String defaultValue) {
        if (first != null && !first.trim().isEmpty()) return first.trim();
        return defaultValue;
    }
}
