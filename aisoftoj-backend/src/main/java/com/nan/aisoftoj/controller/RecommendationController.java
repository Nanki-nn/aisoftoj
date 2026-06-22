package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.dto.recommendation.KnowledgeGraphDTO;
import com.nan.aisoftoj.dto.recommendation.KnowledgeGraphEdgeUpdateRequest;
import com.nan.aisoftoj.dto.recommendation.KnowledgeGraphNodeUpdateRequest;
import com.nan.aisoftoj.dto.recommendation.KnowledgePointRecommendationDTO;
import com.nan.aisoftoj.dto.recommendation.StudyRoadmapDTO;
import com.nan.aisoftoj.dto.recommendation.StudyRoadmapRequest;
import com.nan.aisoftoj.service.AuthService;
import com.nan.aisoftoj.service.RecommendationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/recommendations")
public class RecommendationController {
    private final RecommendationService recommendationService;
    private final AuthService authService;

    public RecommendationController(RecommendationService recommendationService, AuthService authService) {
        this.recommendationService = recommendationService;
        this.authService = authService;
    }

    @GetMapping("/knowledge-points")
    public ResultDTO<List<KnowledgePointRecommendationDTO>> listKnowledgePointRecommendations(
            HttpServletRequest request) {
        return ResultDTO.success(recommendationService.listKnowledgePointRecommendations(currentUserId(request)));
    }

    @GetMapping("/knowledge-graph")
    public ResultDTO<KnowledgeGraphDTO> getKnowledgeGraph(
            @RequestParam(defaultValue = "focus") String scope,
            HttpServletRequest request) {
        return ResultDTO.success(recommendationService.getKnowledgeGraph(currentUserId(request), scope));
    }

    @PatchMapping("/knowledge-graph/nodes/{nodeId}")
    public ResultDTO<KnowledgeGraphDTO> updateKnowledgeGraphNode(
            @PathVariable String nodeId,
            @Valid @RequestBody KnowledgeGraphNodeUpdateRequest body,
            HttpServletRequest request) {
        return ResultDTO.success(recommendationService.updateKnowledgeGraphNode(
                currentUserId(request),
                nodeId,
                body));
    }

    @PatchMapping("/knowledge-graph/edges/{edgeId}")
    public ResultDTO<KnowledgeGraphDTO> updateKnowledgeGraphEdge(
            @PathVariable String edgeId,
            @Valid @RequestBody KnowledgeGraphEdgeUpdateRequest body,
            HttpServletRequest request) {
        return ResultDTO.success(recommendationService.updateKnowledgeGraphEdge(
                currentUserId(request),
                edgeId,
                body));
    }

    @DeleteMapping("/knowledge-graph/edges/{edgeId}")
    public ResultDTO<KnowledgeGraphDTO> deleteKnowledgeGraphEdge(
            @PathVariable String edgeId,
            HttpServletRequest request) {
        return ResultDTO.success(recommendationService.deleteKnowledgeGraphEdge(
                currentUserId(request),
                edgeId));
    }

    @PostMapping("/study-roadmap")
    public ResultDTO<StudyRoadmapDTO> generateStudyRoadmap(
            @RequestBody StudyRoadmapRequest body,
            HttpServletRequest request) {
        return ResultDTO.success(recommendationService.generateStudyRoadmap(currentUserId(request), body));
    }

    private Integer currentUserId(HttpServletRequest request) {
        return authService.getCurrentUserId(request.getHeader("Authorization"));
    }
}
