package com.nan.aisoftoj.service;

import com.nan.aisoftoj.dto.recommendation.KnowledgeGraphDTO;
import com.nan.aisoftoj.dto.recommendation.KnowledgeGraphEdgeUpdateRequest;
import com.nan.aisoftoj.dto.recommendation.KnowledgeGraphNodeUpdateRequest;
import com.nan.aisoftoj.dto.recommendation.KnowledgePointRecommendationDTO;
import com.nan.aisoftoj.dto.recommendation.StudyRoadmapDTO;
import com.nan.aisoftoj.dto.recommendation.StudyRoadmapRequest;

import java.util.List;

public interface RecommendationService {
    List<KnowledgePointRecommendationDTO> listKnowledgePointRecommendations(Integer userId);

    KnowledgeGraphDTO getKnowledgeGraph(Integer userId, String scope);

    KnowledgeGraphDTO updateKnowledgeGraphNode(
            Integer userId,
            String nodeId,
            KnowledgeGraphNodeUpdateRequest request);

    KnowledgeGraphDTO updateKnowledgeGraphEdge(
            Integer userId,
            String edgeId,
            KnowledgeGraphEdgeUpdateRequest request);

    KnowledgeGraphDTO deleteKnowledgeGraphEdge(Integer userId, String edgeId);

    StudyRoadmapDTO generateStudyRoadmap(Integer userId, StudyRoadmapRequest request);
}
