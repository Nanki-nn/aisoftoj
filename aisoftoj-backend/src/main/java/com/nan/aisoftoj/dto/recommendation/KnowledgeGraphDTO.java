package com.nan.aisoftoj.dto.recommendation;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
public class KnowledgeGraphDTO {
    private List<NodeDTO> nodes = new ArrayList<>();
    private List<EdgeDTO> edges = new ArrayList<>();
    private boolean graphAvailable;
    private String source;

    @Data
    public static class NodeDTO {
        private String id;
        private String label;
        private String type;
        private Integer score;
        private Integer mastery;
        private Integer errorCount;
        private Map<String, Object> properties;
    }

    @Data
    public static class EdgeDTO {
        private String id;
        private String source;
        private String target;
        private String type;
        private String label;
        private Double weight;
        private String evidence;
        private String sourceType;
        private Map<String, Object> properties;
    }
}
