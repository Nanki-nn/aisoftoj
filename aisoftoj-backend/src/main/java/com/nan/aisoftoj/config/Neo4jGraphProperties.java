package com.nan.aisoftoj.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "graph.neo4j")
public class Neo4jGraphProperties {
    private String uri;
    private String username;
    private String password;
    private String database;
    private boolean syncEnabled = true;
}
