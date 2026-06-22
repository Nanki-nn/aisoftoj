package com.nan.aisoftoj.config;

import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class Neo4jGraphConfig {
    @Bean(destroyMethod = "close")
    public Driver neo4jDriver(Neo4jGraphProperties properties) {
        return GraphDatabase.driver(
                properties.getUri(),
                AuthTokens.basic(properties.getUsername(), properties.getPassword())
        );
    }
}
