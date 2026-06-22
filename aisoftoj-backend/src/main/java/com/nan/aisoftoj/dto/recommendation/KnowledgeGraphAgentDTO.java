package com.nan.aisoftoj.dto.recommendation;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class KnowledgeGraphAgentDTO {
    private List<NodeDTO> nodes = new ArrayList<>();
    private List<EdgeDTO> edges = new ArrayList<>();

    @Data
    public static class NodeDTO {
        private String id;
        private String name;
        private String type;
        private String subject;
        private String category;
        private Double confidence;
        private String source;
    }

    @Data
    public static class EdgeDTO {
        private String source;
        private String target;
        private String type;
        private String label;
        private Double weight;
        private String evidence;
    }
}
