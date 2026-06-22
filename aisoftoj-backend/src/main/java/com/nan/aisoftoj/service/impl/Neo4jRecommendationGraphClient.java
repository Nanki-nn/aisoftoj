package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.config.Neo4jGraphProperties;
import com.nan.aisoftoj.dto.recommendation.KnowledgeGraphAgentDTO;
import com.nan.aisoftoj.dto.recommendation.KnowledgeGraphDTO;
import com.nan.aisoftoj.dto.recommendation.WrongQuestionEvidenceDTO;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Session;
import org.neo4j.driver.SessionConfig;
import org.neo4j.driver.Transaction;
import org.neo4j.driver.Value;
import org.neo4j.driver.Values;
import org.springframework.stereotype.Component;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class Neo4jRecommendationGraphClient {
    private static final Set<String> AGENT_RELATION_TYPES = new HashSet<>(Arrays.asList(
            "PREREQUISITE_OF",
            "RELATED_TO",
            "CONTAINS",
            "CONFUSED_WITH"));

    private final Driver driver;
    private final Neo4jGraphProperties properties;
    private final SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

    public Neo4jRecommendationGraphClient(Driver driver, Neo4jGraphProperties properties) {
        this.driver = driver;
        this.properties = properties;
    }

    public void rebuildUserGraph(
            Integer userId,
            List<WrongQuestionEvidenceDTO> evidences,
            KnowledgeGraphAgentDTO agentGraph) {
        if (!properties.isSyncEnabled()) {
            return;
        }
        try (Session session = driver.session(sessionConfig())) {
            session.writeTransaction(tx -> {
                ensureConstraints(tx);
                return null;
            });
            session.writeTransaction(tx -> {
                tx.run("MERGE (:User {id: $userId})", Values.parameters("userId", String.valueOf(userId)));
                tx.run("MATCH (:User {id: $userId})-[r:WRONG_ON|WEAK_AT]->() DELETE r",
                        Values.parameters("userId", String.valueOf(userId)));
                for (WrongQuestionEvidenceDTO evidence : evidences) {
                    syncEvidence(tx, userId, evidence);
                }
                clearUserGeneratedRelations(tx, userId);
                syncAgentGraph(tx, agentGraph);
                syncKnowledgeRelations(tx, userId);
                return null;
            });
        }
    }

    public void syncWrongQuestionEvidence(Integer userId, List<WrongQuestionEvidenceDTO> evidences) {
        if (!properties.isSyncEnabled() || evidences == null || evidences.isEmpty()) {
            return;
        }
        try (Session session = driver.session(sessionConfig())) {
            session.writeTransaction(tx -> {
                ensureConstraints(tx);
                return null;
            });
            session.writeTransaction(tx -> {
                for (WrongQuestionEvidenceDTO evidence : evidences) {
                    syncEvidence(tx, userId, evidence);
                }
                return null;
            });
        }
    }

    public KnowledgeGraphDTO loadUserWeakGraph(Integer userId) {
        KnowledgeGraphDTO graph = new KnowledgeGraphDTO();
        graph.setGraphAvailable(true);
        graph.setSource("neo4j");
        Map<String, KnowledgeGraphDTO.NodeDTO> nodes = new HashMap<>();
        try (Session session = driver.session(sessionConfig())) {
            session.readTransaction(tx -> {
                List<Record> weakRecords = tx.run(
                        "MATCH (u:User {id: $userId})-[w:WEAK_AT]->(kp:KnowledgePoint) " +
                                "RETURN kp, w " +
                                "ORDER BY w.score DESC LIMIT 18",
                        Values.parameters("userId", String.valueOf(userId))
                ).list();
                for (Record record : weakRecords) {
                    Value kp = record.get("kp");
                    Value w = record.get("w");
                    addKnowledgeNode(nodes, kp, w);
                }

                List<String> knowledgeIds = new ArrayList<>();
                for (KnowledgeGraphDTO.NodeDTO node : nodes.values()) {
                    if (!"question".equals(node.getType())) {
                        knowledgeIds.add(node.getId());
                    }
                }

                List<Record> questionRecords = tx.run(
                        "MATCH (u:User {id: $userId})-[:WRONG_ON]->(q:Question)-[t:TESTS|PENDING_TESTS]->(kp:KnowledgePoint) " +
                                "WHERE kp.id IN $knowledgeIds " +
                                "RETURN q, kp.id AS kpId, type(t) AS relType, coalesce(t.confidence, 1.0) AS weight, " +
                                "       coalesce(t.evidence, '') AS evidence, coalesce(t.source, 'wrong_question') AS sourceType " +
                                "ORDER BY weight DESC LIMIT 160",
                        Values.parameters(
                                "userId", String.valueOf(userId),
                                "knowledgeIds", knowledgeIds)
                ).list();
                for (Record record : questionRecords) {
                    Value question = record.get("q");
                    addQuestionNode(nodes, question);
                    String relType = record.get("relType").asString();
                    addEdge(
                            graph,
                            edgeId(question.get("id").asString(), relType, record.get("kpId").asString()),
                            question.get("id").asString(),
                            record.get("kpId").asString(),
                            relType,
                            questionRelationLabel(relType),
                            record.get("weight").asDouble(1.0),
                            record.get("evidence").asString(),
                            record.get("sourceType").asString(),
                            "");
                }

                knowledgeIds.clear();
                for (KnowledgeGraphDTO.NodeDTO node : nodes.values()) {
                    if (!"question".equals(node.getType())) {
                        knowledgeIds.add(node.getId());
                    }
                }
                List<Record> relationRecords = tx.run(
                        "MATCH (source:KnowledgePoint)-[r:PREREQUISITE_OF|RELATED_TO|CONTAINS|CONFUSED_WITH]->(target:KnowledgePoint) " +
                                "WHERE source.id IN $knowledgeIds AND target.id IN $knowledgeIds " +
                                "RETURN source.id AS sourceId, target.id AS targetId, type(r) AS relType, " +
                                "       coalesce(r.weight, 0.6) AS weight, " +
                                "       coalesce(r.id, source.id + '-' + type(r) + '-' + target.id) AS edgeId, " +
                                "       coalesce(r.label, '') AS label, coalesce(r.evidence, '') AS evidence, " +
                                "       coalesce(r.source, '') AS sourceType, coalesce(r.reason, '') AS reason " +
                                "ORDER BY weight DESC LIMIT 180",
                        Values.parameters("knowledgeIds", knowledgeIds)
                ).list();
                for (Record record : relationRecords) {
                    String sourceId = record.get("sourceId").asString();
                    String targetId = record.get("targetId").asString();
                    String relType = record.get("relType").asString();
                    String label = firstNonBlank(record.get("label").asString(), relationLabel(relType));
                    addEdge(
                            graph,
                            record.get("edgeId").asString(),
                            sourceId,
                            targetId,
                            relType,
                            label,
                            record.get("weight").asDouble(0.6),
                            record.get("evidence").asString(),
                            record.get("sourceType").asString(),
                            record.get("reason").asString());
                }
                return null;
            });
        }
        graph.getNodes().addAll(nodes.values());
        return graph;
    }

    public KnowledgeGraphDTO loadUserFullGraph(Integer userId) {
        KnowledgeGraphDTO graph = new KnowledgeGraphDTO();
        graph.setGraphAvailable(true);
        graph.setSource("neo4j_full");
        Map<String, KnowledgeGraphDTO.NodeDTO> nodes = new HashMap<>();
        try (Session session = driver.session(sessionConfig())) {
            session.readTransaction(tx -> {
                List<Record> knowledgeRecords = tx.run(
                        "MATCH (u:User {id: $userId})-[:OWNS_DOCUMENT]->(:KnowledgeDocument)-[:HAS_CHUNK]->(:Chunk)-[:MENTIONS]->(kp:KnowledgePoint) " +
                                "WITH DISTINCT u, kp " +
                                "OPTIONAL MATCH (u)-[w:WEAK_AT]->(kp) " +
                                "RETURN kp, w " +
                                "ORDER BY CASE WHEN w IS NULL THEN 1 ELSE 0 END, coalesce(w.score, 0) DESC, kp.name " +
                                "LIMIT 1200",
                        Values.parameters("userId", String.valueOf(userId))
                ).list();
                for (Record record : knowledgeRecords) {
                    Value weakRelation = record.get("w");
                    if (weakRelation.isNull()) {
                        addRelatedKnowledgeNode(nodes, record.get("kp"));
                    } else {
                        addKnowledgeNode(nodes, record.get("kp"), weakRelation);
                    }
                }

                List<String> knowledgeIds = new ArrayList<>(nodes.keySet());
                if (knowledgeIds.isEmpty()) {
                    return null;
                }
                List<Record> questionRecords = tx.run(
                        "MATCH (u:User {id: $userId})-[:WRONG_ON]->(q:Question)-[t:TESTS|PENDING_TESTS]->(kp:KnowledgePoint) " +
                                "WHERE kp.id IN $knowledgeIds " +
                                "RETURN q, kp.id AS kpId, type(t) AS relType, coalesce(t.confidence, 1.0) AS weight, " +
                                "       coalesce(t.evidence, '') AS evidence, coalesce(t.source, 'wrong_question') AS sourceType " +
                                "ORDER BY weight DESC LIMIT 500",
                        Values.parameters(
                                "userId", String.valueOf(userId),
                                "knowledgeIds", knowledgeIds)
                ).list();
                for (Record record : questionRecords) {
                    Value question = record.get("q");
                    addQuestionNode(nodes, question);
                    String relationType = record.get("relType").asString();
                    addEdge(
                            graph,
                            edgeId(question.get("id").asString(), relationType, record.get("kpId").asString()),
                            question.get("id").asString(),
                            record.get("kpId").asString(),
                            relationType,
                            questionRelationLabel(relationType),
                            record.get("weight").asDouble(1.0),
                            record.get("evidence").asString(),
                            record.get("sourceType").asString(),
                            "");
                }

                List<Record> relationRecords = tx.run(
                        "MATCH (source:KnowledgePoint)-[r:PREREQUISITE_OF|RELATED_TO|CONTAINS|CONFUSED_WITH]->(target:KnowledgePoint) " +
                                "WHERE source.id IN $knowledgeIds AND target.id IN $knowledgeIds " +
                                "RETURN source.id AS sourceId, target.id AS targetId, type(r) AS relType, " +
                                "       coalesce(r.weight, 0.6) AS weight, " +
                                "       coalesce(r.id, source.id + '-' + type(r) + '-' + target.id) AS edgeId, " +
                                "       coalesce(r.label, '') AS label, coalesce(r.evidence, '') AS evidence, " +
                                "       coalesce(r.source, '') AS sourceType, coalesce(r.reason, '') AS reason " +
                                "ORDER BY weight DESC LIMIT 2000",
                        Values.parameters("knowledgeIds", knowledgeIds)
                ).list();
                for (Record record : relationRecords) {
                    String relationType = record.get("relType").asString();
                    addEdge(
                            graph,
                            record.get("edgeId").asString(),
                            record.get("sourceId").asString(),
                            record.get("targetId").asString(),
                            relationType,
                            firstNonBlank(record.get("label").asString(), relationLabel(relationType)),
                            record.get("weight").asDouble(0.6),
                            record.get("evidence").asString(),
                            record.get("sourceType").asString(),
                            record.get("reason").asString());
                }
                return null;
            });
        }
        graph.getNodes().addAll(nodes.values());
        return graph;
    }

    public void updateKnowledgeNode(Integer userId, String nodeId, String label) {
        if (!properties.isSyncEnabled()) {
            throw new IllegalStateException("Neo4j 图谱同步未启用");
        }
        String normalizedLabel = firstNonBlank(label, "");
        if (isBlank(nodeId) || isBlank(normalizedLabel)) {
            throw new IllegalArgumentException("知识点节点或名称不能为空");
        }
        try (Session session = driver.session(sessionConfig())) {
            session.writeTransaction(tx -> {
                ensureConstraints(tx);
                return null;
            });
            session.writeTransaction(tx -> {
                List<Record> records = tx.run(
                        "MATCH (u:User {id: $userId})-[:WEAK_AT]->(weak:KnowledgePoint) " +
                                "MATCH (kp:KnowledgePoint {id: $nodeId}) " +
                                "WHERE weak = kp OR (weak)-[:PREREQUISITE_OF|RELATED_TO|CONTAINS|CONFUSED_WITH]-(kp) " +
                                "SET kp.name = $label, kp.labelSource = 'manual', kp.source = coalesce(kp.source, 'manual'), " +
                                "    kp.updatedBy = $userId, kp.updatedAt = datetime() " +
                                "RETURN kp.id AS id LIMIT 1",
                        Values.parameters(
                                "userId", String.valueOf(userId),
                                "nodeId", nodeId,
                                "label", normalizedLabel)
                ).list();
                if (records.isEmpty()) {
                    throw new IllegalArgumentException("知识点节点不存在或无权编辑");
                }
                return null;
            });
        }
    }

    public void updateKnowledgeEdge(
            Integer userId,
            String edgeId,
            String type,
            String label,
            Double weight) {
        if (!properties.isSyncEnabled()) {
            throw new IllegalStateException("Neo4j 图谱同步未启用");
        }
        String relationType = sanitizeRelationType(type);
        if (isBlank(edgeId) || relationType == null) {
            throw new IllegalArgumentException("关系不存在或关系类型不合法");
        }
        String normalizedLabel = firstNonBlank(label, relationLabel(relationType));
        double normalizedWeight = clamp(weight, 0.05, 1.0, 0.65);
        try (Session session = driver.session(sessionConfig())) {
            session.writeTransaction(tx -> {
                ensureConstraints(tx);
                return null;
            });
            session.writeTransaction(tx -> {
                List<Record> records = tx.run(
                        "MATCH (u:User {id: $userId})-[:WEAK_AT]->(weak:KnowledgePoint) " +
                                "MATCH (a:KnowledgePoint)-[r:PREREQUISITE_OF|RELATED_TO|CONTAINS|CONFUSED_WITH]-(b:KnowledgePoint) " +
                                "WHERE (weak = a OR weak = b) " +
                                "  AND coalesce(r.id, startNode(r).id + '-' + type(r) + '-' + endNode(r).id) = $edgeId " +
                                "RETURN startNode(r).id AS sourceId, endNode(r).id AS targetId, " +
                                "       coalesce(r.evidence, '') AS evidence LIMIT 1",
                        Values.parameters("userId", String.valueOf(userId), "edgeId", edgeId)
                ).list();
                if (records.isEmpty()) {
                    throw new IllegalArgumentException("关系不存在或无权编辑");
                }
                Record record = records.get(0);
                tx.run(
                        "MATCH (a:KnowledgePoint)-[r:PREREQUISITE_OF|RELATED_TO|CONTAINS|CONFUSED_WITH]-(b:KnowledgePoint) " +
                                "WHERE coalesce(r.id, startNode(r).id + '-' + type(r) + '-' + endNode(r).id) = $edgeId " +
                                "DELETE r",
                        Values.parameters("edgeId", edgeId)
                );
                String sourceId = record.get("sourceId").asString();
                String targetId = record.get("targetId").asString();
                String newEdgeId = edgeId(sourceId, relationType, targetId);
                tx.run("MATCH (source:KnowledgePoint {id: $sourceId}) " +
                                "MATCH (target:KnowledgePoint {id: $targetId}) " +
                                "MERGE (source)-[r:" + relationType + "]->(target) " +
                                "SET r.id = $edgeId, " +
                                "    r.weight = $weight, " +
                                "    r.label = $label, " +
                                "    r.evidence = $evidence, " +
                                "    r.reason = 'manual_edit', " +
                                "    r.source = 'manual', " +
                                "    r.updatedBy = $userId, " +
                                "    r.updatedAt = datetime()",
                        Values.parameters(
                                "sourceId", sourceId,
                                "targetId", targetId,
                                "edgeId", newEdgeId,
                                "weight", normalizedWeight,
                                "label", normalizedLabel,
                                "evidence", record.get("evidence").asString(),
                                "userId", String.valueOf(userId)));
                return null;
            });
        }
    }

    public void deleteKnowledgeEdge(Integer userId, String edgeId) {
        if (!properties.isSyncEnabled()) {
            throw new IllegalStateException("Neo4j 图谱同步未启用");
        }
        if (isBlank(edgeId)) {
            throw new IllegalArgumentException("关系不能为空");
        }
        try (Session session = driver.session(sessionConfig())) {
            session.writeTransaction(tx -> {
                List<Record> records = tx.run(
                        "MATCH (u:User {id: $userId})-[:WEAK_AT]->(weak:KnowledgePoint) " +
                                "MATCH (a:KnowledgePoint)-[r:PREREQUISITE_OF|RELATED_TO|CONTAINS|CONFUSED_WITH]-(b:KnowledgePoint) " +
                                "WHERE (weak = a OR weak = b) " +
                                "  AND coalesce(r.id, startNode(r).id + '-' + type(r) + '-' + endNode(r).id) = $edgeId " +
                                "DELETE r RETURN count(*) AS deleted",
                        Values.parameters("userId", String.valueOf(userId), "edgeId", edgeId)
                ).list();
                if (records.isEmpty() || records.get(0).get("deleted").asInt(0) == 0) {
                    throw new IllegalArgumentException("关系不存在或无权删除");
                }
                return null;
            });
        }
    }

    public void markDocumentGraphStatus(
            String documentId,
            Integer version,
            String status,
            String message) {
        if (!properties.isSyncEnabled() || isBlank(documentId)) {
            return;
        }
        try (Session session = driver.session(sessionConfig())) {
            session.writeTransaction(tx -> {
                ensureConstraints(tx);
                return null;
            });
            session.writeTransaction(tx -> {
                tx.run("MERGE (d:KnowledgeDocument {id: $documentId}) " +
                                "SET d.version = $version, d.graphStatus = $status, " +
                                "    d.graphErrorMessage = $message, d.graphUpdatedAt = datetime()",
                        Values.parameters(
                                "documentId", documentId,
                                "version", version == null ? 1 : version,
                                "status", firstNonBlank(status, "unknown"),
                                "message", firstNonBlank(message, "")));
                return null;
            });
        }
    }

    public Map<String, Object> documentGraphStatus(String documentId, Integer version) {
        Map<String, Object> unavailable = new HashMap<>();
        if (!properties.isSyncEnabled() || isBlank(documentId)) {
            unavailable.put("graphStatus", "disabled");
            return unavailable;
        }
        try (Session session = driver.session(sessionConfig())) {
            return session.readTransaction(tx -> {
                Map<String, Object> result = new HashMap<>();
                List<Record> records = tx.run(
                        "MATCH (d:KnowledgeDocument {id: $documentId}) " +
                                "OPTIONAL MATCH (d)-[:HAS_CHUNK]->(:Chunk)-[:MENTIONS]->(kp:KnowledgePoint) " +
                                "OPTIONAL MATCH (:KnowledgePoint)-[r:PREREQUISITE_OF|RELATED_TO|CONTAINS|CONFUSED_WITH]-(:KnowledgePoint) " +
                                "WHERE r.documentId = $documentId " +
                                "RETURN coalesce(d.graphStatus, 'none') AS graphStatus, " +
                                "       coalesce(d.graphErrorMessage, '') AS graphErrorMessage, " +
                                "       coalesce(toString(d.graphUpdatedAt), '') AS graphUpdatedAt, " +
                                "       count(DISTINCT kp) AS nodeCount, count(DISTINCT r) AS relationCount, " +
                                "       coalesce(d.graphPendingCount, 0) AS pendingCount " +
                                "LIMIT 1",
                        Values.parameters("documentId", documentId)
                ).list();
                if (records.isEmpty()) {
                    result.put("graphStatus", "none");
                    result.put("graphNodeCount", 0);
                    result.put("graphRelationCount", 0);
                    result.put("graphPendingCount", 0);
                    return result;
                }
                Record record = records.get(0);
                result.put("graphStatus", record.get("graphStatus").asString("none"));
                result.put("graphErrorMessage", record.get("graphErrorMessage").asString(""));
                result.put("graphUpdatedAt", record.get("graphUpdatedAt").asString(""));
                result.put("graphNodeCount", record.get("nodeCount").asInt(0));
                result.put("graphRelationCount", record.get("relationCount").asInt(0));
                result.put("graphPendingCount", record.get("pendingCount").asInt(0));
                return result;
            });
        } catch (Exception exception) {
            unavailable.put("graphStatus", "unavailable");
            unavailable.put("graphErrorMessage", exception.getMessage());
            return unavailable;
        }
    }

    public void syncDocumentKnowledgeGraph(
            Integer userId,
            String documentId,
            String knowledgeBaseId,
            String fileName,
            Integer version,
            Map<String, Object> graph) {
        if (!properties.isSyncEnabled()) {
            throw new IllegalStateException("Neo4j 图谱同步未启用");
        }
        if (isBlank(documentId) || graph == null) {
            throw new IllegalArgumentException("文档图谱数据为空");
        }
        try (Session session = driver.session(sessionConfig())) {
            session.writeTransaction(tx -> {
                ensureConstraints(tx);
                return null;
            });
            session.writeTransaction(tx -> {
                tx.run("MERGE (u:User {id: $userId}) " +
                                "MERGE (d:KnowledgeDocument {id: $documentId}) " +
                                "SET d.knowledgeBaseId = $knowledgeBaseId, d.name = $fileName, d.version = $version, " +
                                "    d.graphStatus = 'running', d.graphErrorMessage = '', d.graphUpdatedAt = datetime() " +
                                "MERGE (u)-[:OWNS_DOCUMENT]->(d)",
                        Values.parameters(
                                "userId", String.valueOf(userId),
                                "documentId", documentId,
                                "knowledgeBaseId", firstNonBlank(knowledgeBaseId, ""),
                                "fileName", firstNonBlank(fileName, documentId),
                                "version", version == null ? 1 : version));
                clearDocumentGeneratedGraph(tx, documentId);
                syncKgEntityNodes(tx, graph);
                syncKgChunks(tx, documentId, knowledgeBaseId, graph);
                syncKgMentions(tx, documentId, graph);
                syncKgBusinessRelations(tx, documentId, graph);
                syncWrongQuestionAlignments(tx, userId, documentId, graph);
                tx.run("MATCH (d:KnowledgeDocument {id: $documentId}) " +
                                "SET d.graphStatus = 'completed', d.graphNodeCount = $nodeCount, " +
                                "    d.graphRelationCount = $edgeCount, d.graphPendingCount = $pendingCount, " +
                                "    d.graphUpdatedAt = datetime()",
                        Values.parameters(
                                "documentId", documentId,
                                "nodeCount", asList(graph.get("entity_nodes")).size(),
                                "edgeCount", countBusinessEntityRelations(graph),
                                "pendingCount", 0));
                return null;
            });
        }
    }

    public void deleteDocumentKnowledgeGraph(String documentId) {
        if (!properties.isSyncEnabled()) {
            throw new IllegalStateException("Neo4j 鍥捐氨鍚屾鏈惎鐢?");
        }
        if (isBlank(documentId)) {
            throw new IllegalArgumentException("鏂囨。 ID 涓嶈兘涓虹┖");
        }
        try (Session session = driver.session(sessionConfig())) {
            session.writeTransaction(tx -> {
                ensureConstraints(tx);
                return null;
            });
            session.writeTransaction(tx -> {
                clearDocumentGeneratedGraph(tx, documentId);
                tx.run("MATCH (d:KnowledgeDocument {id: $documentId}) " +
                                "SET d.graphStatus = 'none', d.graphNodeCount = 0, " +
                                "    d.graphRelationCount = 0, d.graphPendingCount = 0, " +
                                "    d.graphErrorMessage = '', d.graphUpdatedAt = datetime()",
                        Values.parameters("documentId", documentId));
                return null;
            });
        }
    }

    private SessionConfig sessionConfig() {
        return SessionConfig.forDatabase(properties.getDatabase());
    }

    private void ensureConstraints(Transaction tx) {
        tx.run("CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE");
        tx.run("CREATE CONSTRAINT question_id_unique IF NOT EXISTS FOR (q:Question) REQUIRE q.id IS UNIQUE");
        tx.run("CREATE CONSTRAINT knowledge_point_id_unique IF NOT EXISTS FOR (kp:KnowledgePoint) REQUIRE kp.id IS UNIQUE");
        tx.run("CREATE CONSTRAINT knowledge_document_id_unique IF NOT EXISTS FOR (d:KnowledgeDocument) REQUIRE d.id IS UNIQUE");
        tx.run("CREATE CONSTRAINT chunk_id_unique IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE");
    }

    private void clearDocumentGeneratedGraph(Transaction tx, String documentId) {
        tx.run("MATCH (:KnowledgePoint)-[r:PREREQUISITE_OF|RELATED_TO|CONTAINS|CONFUSED_WITH]-(:KnowledgePoint) " +
                        "WHERE r.documentId = $documentId AND coalesce(r.source, '') = 'knowledge_base' DELETE r",
                Values.parameters("documentId", documentId));
        tx.run("MATCH (:Question)-[r:TESTS|PENDING_TESTS]->(:KnowledgePoint) " +
                        "WHERE r.documentId = $documentId " +
                        "  AND coalesce(r.source, '') IN ['knowledge_base', 'knowledge_base_mapping', 'llm_kg_alignment'] " +
                        "DELETE r",
                Values.parameters("documentId", documentId));
        tx.run("MATCH (d:KnowledgeDocument {id: $documentId})-[:HAS_CHUNK]->(c:Chunk) " +
                        "OPTIONAL MATCH (c)-[:MENTIONS]->(kp:KnowledgePoint) " +
                        "WITH collect(DISTINCT c) AS chunks, collect(DISTINCT kp) AS points " +
                        "FOREACH (chunk IN chunks | DETACH DELETE chunk) " +
                        "WITH points UNWIND points AS kp " +
                        "WITH DISTINCT kp WHERE kp IS NOT NULL AND coalesce(kp.source, '') = 'knowledge_base' " +
                        "OPTIONAL MATCH (:Chunk)-[:MENTIONS]->(kp) " +
                        "WITH kp, count(*) AS remainingMentions WHERE remainingMentions = 0 " +
                        "DETACH DELETE kp",
                Values.parameters("documentId", documentId));
    }

    private void syncKgEntityNodes(Transaction tx, Map<String, Object> graph) {
        for (Map<String, Object> raw : asList(graph.get("entity_nodes"))) {
            String id = string(raw.get("entity_id"));
            String canonicalName = firstNonBlank(string(raw.get("canonical_name")), string(raw.get("name")));
            if (isBlank(id) || isBlank(canonicalName)) {
                continue;
            }
            Map<String, Object> params = new HashMap<>();
            params.put("id", id);
            params.put("name", firstNonBlank(string(raw.get("name")), canonicalName));
            params.put("canonicalName", canonicalName);
            params.put("aliases", stringList(raw.get("aliases")));
            params.put("subject", firstNonBlank(firstHeading(raw), "general"));
            params.put("definition", "");
            params.put("headingPath", stringList(raw.get("heading_path")));
            params.put("disambiguationKey", firstNonBlank(string(raw.get("disambiguation_key")), ""));
            params.put("source", "knowledge_base");
            params.put("confidence", 0.75);
            tx.run("MERGE (kp:KnowledgePoint {id: $id}) " +
                            "SET kp.name = CASE WHEN kp.labelSource = 'manual' THEN kp.name ELSE $name END, " +
                            "    kp.canonicalName = CASE WHEN kp.labelSource = 'manual' THEN coalesce(kp.canonicalName, kp.name) ELSE $canonicalName END, " +
                            "    kp.aliases = $aliases, kp.subject = $subject, kp.definition = $definition, " +
                            "    kp.headingPath = $headingPath, kp.disambiguationKey = $disambiguationKey, " +
                            "    kp.source = CASE WHEN coalesce(kp.source, '') = 'manual' THEN kp.source ELSE $source END, " +
                            "    kp.confidence = $confidence, kp.resolutionStatus = 'new', " +
                            "    kp.resolutionMethod = 'kg_structure', kp.resolutionConfidence = $confidence, " +
                            "    kp.updatedAt = datetime()",
                    params);
        }
    }

    private void syncKgChunks(
            Transaction tx,
            String documentId,
            String knowledgeBaseId,
            Map<String, Object> graph) {
        for (Map<String, Object> raw : asList(graph.get("kg_extraction_chunks"))) {
            String chunkId = string(raw.get("kg_chunk_id"));
            if (isBlank(chunkId)) {
                continue;
            }
            Map<String, Object> params = new HashMap<>();
            params.put("documentId", documentId);
            params.put("chunkId", chunkId);
            params.put("knowledgeBaseId", firstNonBlank(knowledgeBaseId, ""));
            params.put("page", raw.get("page_start"));
            params.put("pageEnd", raw.get("page_end"));
            params.put("sourcePageRange", firstNonBlank(string(raw.get("source_page_range")), ""));
            params.put("headingPath", stringList(raw.get("heading_path")));
            params.put("parentHeadingId", firstNonBlank(string(raw.get("parent_heading_id")), ""));
            params.put("text", truncate(string(raw.get("text")), 1000));
            tx.run("MATCH (d:KnowledgeDocument {id: $documentId}) " +
                            "MERGE (c:Chunk {id: $chunkId}) " +
                            "SET c.documentId = $documentId, c.knowledgeBaseId = $knowledgeBaseId, " +
                            "    c.page = $page, c.pageEnd = $pageEnd, c.sourcePageRange = $sourcePageRange, " +
                            "    c.headingPath = $headingPath, c.parentHeadingId = $parentHeadingId, " +
                            "    c.text = $text, c.chunkType = 'kg_extraction' " +
                            "MERGE (d)-[:HAS_CHUNK]->(c)",
                    params);
        }
    }

    private void syncKgMentions(Transaction tx, String documentId, Map<String, Object> graph) {
        for (Map<String, Object> raw : asList(graph.get("entity_nodes"))) {
            String knowledgePointId = string(raw.get("entity_id"));
            if (isBlank(knowledgePointId)) {
                continue;
            }
            for (String chunkId : stringList(raw.get("source_kg_chunk_ids"))) {
                Map<String, Object> params = new HashMap<>();
                params.put("documentId", documentId);
                params.put("chunkId", chunkId);
                params.put("knowledgePointId", knowledgePointId);
                params.put("confidence", 0.85);
                params.put("evidence", firstNonBlank(
                        string(raw.get("canonical_name")),
                        string(raw.get("name"))));
                tx.run("MATCH (d:KnowledgeDocument {id: $documentId})-[:HAS_CHUNK]->(c:Chunk {id: $chunkId}) " +
                                "MATCH (kp:KnowledgePoint {id: $knowledgePointId}) " +
                                "MERGE (c)-[m:MENTIONS]->(kp) " +
                                "SET m.confidence = $confidence, m.evidence = $evidence, m.source = 'knowledge_base'",
                        params);
            }
        }
    }

    private void syncKgBusinessRelations(Transaction tx, String documentId, Map<String, Object> graph) {
        for (Map<String, Object> raw : asList(graph.get("relations"))) {
            if (!"business".equals(string(raw.get("relation_category")))) {
                continue;
            }
            String source = string(raw.get("subject"));
            String target = string(raw.get("object"));
            String predicate = string(raw.get("predicate"));
            String relationType = relationTypeFromKgPredicate(predicate);
            if (!source.startsWith("entity:")
                    || !target.startsWith("entity:")
                    || relationType == null
                    || source.equals(target)) {
                continue;
            }
            Map<String, Object> params = new HashMap<>();
            params.put("sourceId", source);
            params.put("targetId", target);
            params.put("edgeId", edgeId(source, relationType, target));
            params.put("weight", number(raw.get("confidence"), 0.6));
            params.put("confidence", number(raw.get("confidence"), 0.6));
            params.put("label", firstNonBlank(predicate, relationLabel(relationType)));
            params.put("evidence", firstNonBlank(string(raw.get("evidence_text")), ""));
            params.put("chunkId", firstNonBlank(string(raw.get("source_kg_chunk_id")), ""));
            params.put("documentId", documentId);
            params.put("page", firstNonBlank(string(raw.get("source_page_range")), ""));
            params.put("contextDependency", firstNonBlank(string(raw.get("context_dependency")), ""));
            tx.run("MATCH (source:KnowledgePoint {id: $sourceId}) " +
                            "MATCH (target:KnowledgePoint {id: $targetId}) " +
                            "MERGE (source)-[r:" + relationType + "]->(target) " +
                            "FOREACH (_ IN CASE WHEN coalesce(r.source, '') = 'manual' THEN [] ELSE [1] END | " +
                            "  SET r.id = $edgeId, r.weight = $weight, r.confidence = $confidence, " +
                            "      r.label = $label, r.evidence = $evidence, r.chunkId = $chunkId, " +
                            "      r.documentId = $documentId, r.page = $page, " +
                            "      r.contextDependency = $contextDependency, r.source = 'knowledge_base', " +
                            "      r.reason = 'kg_structure_extraction', r.updatedAt = datetime())",
                    params);
        }
    }

    private void syncWrongQuestionAlignments(
            Transaction tx,
            Integer userId,
            String documentId,
            Map<String, Object> graph) {
        for (Map<String, Object> raw : asList(graph.get("wrong_question_alignments"))) {
            String questionId = firstNonBlank(string(raw.get("question_id")), string(raw.get("questionId")));
            String knowledgePointId = firstNonBlank(
                    string(raw.get("knowledge_point_id")),
                    string(raw.get("knowledgePointId")));
            knowledgePointId = firstNonBlank(knowledgePointId, string(raw.get("entity_id")));
            knowledgePointId = firstNonBlank(knowledgePointId, string(raw.get("entityId")));
            double confidence = number(raw.get("confidence"), 0.0);
            if (isBlank(questionId) || isBlank(knowledgePointId) || confidence < 0.55) {
                continue;
            }
            int score = (int) Math.round(58 + confidence * 34);
            int mastery = Math.max(8, 100 - score);
            Map<String, Object> params = new HashMap<>();
            params.put("userId", String.valueOf(userId));
            params.put("documentId", documentId);
            params.put("questionId", questionId);
            params.put("knowledgePointId", knowledgePointId);
            params.put("confidence", confidence);
            params.put("score", score);
            params.put("mastery", mastery);
            params.put("evidence", firstNonBlank(string(raw.get("evidence_text")), string(raw.get("evidence"))));
            params.put("reason", firstNonBlank(string(raw.get("reason")), ""));
            params.put("contextDependency", firstNonBlank(string(raw.get("context_dependency")), ""));
            params.put("mappingMethod", firstNonBlank(
                    firstNonBlank(string(raw.get("mapping_method")), string(raw.get("mappingMethod"))),
                    "llm_semantic_alignment"));
            tx.run("MATCH (u:User {id: $userId})-[wo:WRONG_ON]->(q:Question {id: $questionId}) " +
                            "MATCH (kp:KnowledgePoint {id: $knowledgePointId}) " +
                            "MERGE (q)-[r:TESTS]->(kp) " +
                            "SET r.confidence = $confidence, r.weight = $confidence, " +
                            "    r.evidence = $evidence, r.reason = $reason, " +
                            "    r.contextDependency = $contextDependency, r.mappingMethod = $mappingMethod, " +
                            "    r.documentId = $documentId, r.source = 'llm_kg_alignment', r.updatedAt = datetime() " +
                            "MERGE (u)-[w:WEAK_AT]->(kp) " +
                            "SET w.score = CASE WHEN coalesce(w.score, 0) < $score THEN $score ELSE w.score END, " +
                            "    w.mastery = CASE WHEN coalesce(w.mastery, 100) > $mastery THEN $mastery ELSE w.mastery END, " +
                            "    w.errorCount = CASE WHEN coalesce(w.errorCount, 0) < coalesce(wo.errorCount, 1) " +
                            "        THEN coalesce(wo.errorCount, 1) ELSE w.errorCount END, " +
                            "    w.source = 'llm_kg_alignment', w.updatedAt = datetime()",
                    params);
        }
    }

    private void syncEvidence(Transaction tx, Integer userId, WrongQuestionEvidenceDTO evidence) {
        String knowledgeName = normalizeKnowledgeName(evidence);
        String questionId = evidence.getQuestionId() == null
                ? "wrong-" + userId + "-" + knowledgeName
                : String.valueOf(evidence.getQuestionId());
        String subject = firstNonBlank(evidence.getSubjectName(), "\u901a\u7528");
        String knowledgeId = resolveKnowledgePointId(tx, subject, knowledgeName);
        int errorCount = evidence.getErrorCount() == null ? 1 : evidence.getErrorCount();
        int score = scoreEvidence(evidence);
        int mastery = Math.max(5, 100 - score);
        Map<String, Object> params = new HashMap<>();
        params.put("userId", String.valueOf(userId));
        params.put("questionId", questionId);
        params.put("questionName", evidence.getQuestionName());
        params.put("questionType", evidence.getQuestionType());
        params.put("difficulty", evidence.getDifficulty() == null ? 2 : evidence.getDifficulty());
        params.put("paperYear", evidence.getPaperYear());
        params.put("kpId", knowledgeId);
        params.put("kpName", knowledgeName);
        params.put("subject", subject);
        params.put("category", knowledgeName);
        params.put("errorCount", errorCount);
        params.put("score", score);
        params.put("mastery", mastery);
        params.put("lastWrongTime", evidence.getLastWrongTime() == null ? "" : dateFormat.format(evidence.getLastWrongTime()));
        tx.run("MERGE (u:User {id: $userId}) " +
                        "MERGE (q:Question {id: $questionId}) " +
                        "SET q.name = $questionName, q.type = $questionType, q.difficulty = $difficulty, q.year = $paperYear " +
                        "MERGE (kp:KnowledgePoint {id: $kpId}) " +
                        "SET kp.name = CASE WHEN kp.labelSource = 'manual' OR coalesce(kp.source, '') = 'knowledge_base' THEN kp.name ELSE $kpName END, " +
                        "    kp.canonicalName = coalesce(kp.canonicalName, $kpName), " +
                        "    kp.subject = $subject, kp.category = $category, " +
                        "    kp.level = 1, kp.importance = 'medium', kp.source = coalesce(kp.source, 'wrong_question') " +
                        "MERGE (q)-[t:TESTS]->(kp) SET t.weight = 1.0 " +
                        "MERGE (u)-[wo:WRONG_ON]->(q) SET wo.errorCount = $errorCount, wo.lastWrongTime = $lastWrongTime " +
                        "MERGE (u)-[w:WEAK_AT]->(kp) " +
                        "SET w.score = coalesce(w.score, 0) + $score, " +
                        "    w.errorCount = coalesce(w.errorCount, 0) + $errorCount, " +
                        "    w.mastery = $mastery",
                params);
    }

    private void clearUserGeneratedRelations(Transaction tx, Integer userId) {
        tx.run("MATCH (u:User {id: $userId})-[:WEAK_AT]->(kp:KnowledgePoint)-[r:PREREQUISITE_OF|RELATED_TO|CONTAINS|CONFUSED_WITH]-() " +
                        "WHERE r.source = 'agent' " +
                        "   OR (coalesce(r.source, '') <> 'manual' " +
                        "       AND r.reason IN ['agent_generated', 'domain_neighbor', 'same_subject_weak_sequence', 'same_category_weak_cluster']) " +
                        "DELETE r",
                Values.parameters("userId", String.valueOf(userId)));
    }

    private void syncAgentGraph(Transaction tx, KnowledgeGraphAgentDTO agentGraph) {
        if (agentGraph == null) {
            return;
        }
        for (KnowledgeGraphAgentDTO.NodeDTO node : agentGraph.getNodes()) {
            if (node == null || isBlank(node.getId()) || isBlank(node.getName())) {
                continue;
            }
            Map<String, Object> params = new HashMap<>();
            params.put("id", node.getId().trim());
            params.put("name", node.getName().trim());
            params.put("subject", firstNonBlank(node.getSubject(), "\u901a\u7528"));
            params.put("category", firstNonBlank(node.getCategory(), node.getName().trim()));
            params.put("confidence", clamp(node.getConfidence(), 0.0, 1.0, 0.6));
            params.put("source", firstNonBlank(node.getSource(), "agent"));
            tx.run("MERGE (kp:KnowledgePoint {id: $id}) " +
                            "SET kp.name = CASE WHEN kp.labelSource = 'manual' THEN kp.name ELSE $name END, " +
                            "    kp.subject = $subject, " +
                            "    kp.category = $category, " +
                            "    kp.level = coalesce(kp.level, 0), " +
                            "    kp.importance = coalesce(kp.importance, 'normal'), " +
                            "    kp.confidence = $confidence, " +
                            "    kp.source = $source",
                    params);
        }

        for (KnowledgeGraphAgentDTO.EdgeDTO edge : agentGraph.getEdges()) {
            if (edge == null || isBlank(edge.getSource()) || isBlank(edge.getTarget())) {
                continue;
            }
            String relationType = sanitizeRelationType(edge.getType());
            if (relationType == null || edge.getSource().trim().equals(edge.getTarget().trim())) {
                continue;
            }
            Map<String, Object> params = new HashMap<>();
            params.put("sourceId", edge.getSource().trim());
            params.put("targetId", edge.getTarget().trim());
            params.put("weight", clamp(edge.getWeight(), 0.05, 1.0, 0.55));
            params.put("label", firstNonBlank(edge.getLabel(), relationLabel(relationType)));
            params.put("evidence", firstNonBlank(edge.getEvidence(), ""));
            params.put("edgeId", edgeId(edge.getSource().trim(), relationType, edge.getTarget().trim()));
            tx.run("MATCH (source:KnowledgePoint {id: $sourceId}) " +
                            "MATCH (target:KnowledgePoint {id: $targetId}) " +
                            "MERGE (source)-[r:" + relationType + "]->(target) " +
                            "SET r.id = $edgeId, " +
                            "    r.weight = $weight, " +
                            "    r.label = $label, " +
                            "    r.evidence = $evidence, " +
                            "    r.reason = 'agent_generated', " +
                            "    r.source = 'agent'",
                    params);
        }
    }

    private void syncKnowledgeRelations(Transaction tx, Integer userId) {
        tx.run("MATCH (u:User {id: $userId})-[:WEAK_AT]->(kp:KnowledgePoint) " +
                        "WITH kp ORDER BY kp.subject, kp.category, kp.name " +
                        "WITH collect(kp)[0..18] AS points " +
                        "UNWIND range(0, size(points) - 2) AS index " +
                        "WITH points[index] AS current, points[index + 1] AS next " +
                        "WHERE current.subject = next.subject " +
                        "MERGE (current)-[r:RELATED_TO]->(next) " +
                        "FOREACH (_ IN CASE WHEN coalesce(r.source, '') = 'manual' THEN [] ELSE [1] END | " +
                        "  SET r.id = current.id + '-RELATED_TO-' + next.id, " +
                        "      r.weight = 0.72, r.reason = 'same_subject_weak_sequence', " +
                        "      r.source = 'agent', r.label = '关联')",
                Values.parameters("userId", String.valueOf(userId)));

        tx.run("MATCH (u:User {id: $userId})-[:WEAK_AT]->(kp:KnowledgePoint) " +
                        "WITH kp ORDER BY kp.subject, kp.category, kp.name " +
                        "WITH kp.subject AS subject, kp.category AS category, collect(kp) AS points " +
                        "WHERE size(points) > 1 " +
                        "UNWIND points AS source " +
                        "UNWIND points AS target " +
                        "WITH source, target WHERE source.id < target.id " +
                        "MERGE (source)-[r:RELATED_TO]->(target) " +
                        "FOREACH (_ IN CASE WHEN coalesce(r.source, '') = 'manual' THEN [] ELSE [1] END | " +
                        "  SET r.id = source.id + '-RELATED_TO-' + target.id, " +
                        "      r.weight = 0.58, r.reason = 'same_category_weak_cluster', " +
                        "      r.source = 'agent', r.label = '关联')",
                Values.parameters("userId", String.valueOf(userId)));
    }

    private void addKnowledgeNode(Map<String, KnowledgeGraphDTO.NodeDTO> nodes, Value kp, Value weakRel) {
        KnowledgeGraphDTO.NodeDTO node = baseNode(kp.get("id").asString(), kp.get("name").asString(), "knowledge");
        node.setScore(weakRel.get("score").asInt(0));
        node.setMastery(weakRel.get("mastery").asInt(100));
        node.setErrorCount(weakRel.get("errorCount").asInt(0));
        applyKnowledgeProperties(node, kp);
        nodes.put(node.getId(), node);
    }

    private void addRelatedKnowledgeNode(Map<String, KnowledgeGraphDTO.NodeDTO> nodes, Value kp) {
        if (nodes.containsKey(kp.get("id").asString())) {
            return;
        }
        KnowledgeGraphDTO.NodeDTO node = baseNode(kp.get("id").asString(), kp.get("name").asString(), "related");
        node.setScore(0);
        node.setMastery(100);
        node.setErrorCount(0);
        applyKnowledgeProperties(node, kp);
        nodes.put(node.getId(), node);
    }

    private void addQuestionNode(Map<String, KnowledgeGraphDTO.NodeDTO> nodes, Value question) {
        KnowledgeGraphDTO.NodeDTO node = baseNode(question.get("id").asString(), question.get("name").asString(), "question");
        node.setErrorCount(0);
        node.setScore(0);
        node.setMastery(0);
        nodes.put(node.getId(), node);
    }

    private KnowledgeGraphDTO.NodeDTO baseNode(String id, String label, String type) {
        KnowledgeGraphDTO.NodeDTO node = new KnowledgeGraphDTO.NodeDTO();
        node.setId(id);
        node.setLabel(label == null || label.trim().isEmpty() ? id : label);
        node.setType(type);
        node.setProperties(new HashMap<>());
        return node;
    }

    private void applyKnowledgeProperties(KnowledgeGraphDTO.NodeDTO node, Value kp) {
        Map<String, Object> properties = node.getProperties();
        properties.put("canonicalName", valueString(kp, "canonicalName", valueString(kp, "name", node.getLabel())));
        properties.put("aliases", valueStringList(kp, "aliases"));
        properties.put("definition", valueString(kp, "definition", ""));
        properties.put("source", valueString(kp, "source", ""));
        properties.put("confidence", kp.get("confidence").asDouble(0.0));
        properties.put("resolutionStatus", valueString(kp, "resolutionStatus", ""));
        properties.put("resolutionMethod", valueString(kp, "resolutionMethod", ""));
    }

    private void addEdge(KnowledgeGraphDTO graph, String source, String target, String type, String label, Double weight) {
        addEdge(graph, edgeId(source, type, target), source, target, type, label, weight, "", "", "");
    }

    private void addEdge(
            KnowledgeGraphDTO graph,
            String id,
            String source,
            String target,
            String type,
            String label,
            Double weight,
            String evidence,
            String sourceType,
            String reason) {
        KnowledgeGraphDTO.EdgeDTO edge = new KnowledgeGraphDTO.EdgeDTO();
        edge.setId(firstNonBlank(id, edgeId(source, type, target)));
        edge.setSource(source);
        edge.setTarget(target);
        edge.setType(type);
        edge.setLabel(label);
        edge.setWeight(weight);
        edge.setEvidence(evidence);
        edge.setSourceType(sourceType);
        Map<String, Object> properties = new HashMap<>();
        properties.put("reason", reason);
        edge.setProperties(properties);
        graph.getEdges().add(edge);
    }

    private String normalizeKnowledgeName(WrongQuestionEvidenceDTO evidence) {
        String name = evidence.getKnowledgePointName();
        if (name == null || name.trim().isEmpty()) {
            name = evidence.getQuestionName();
        }
        return name == null || name.trim().isEmpty() ? "\u672a\u5f52\u7c7b\u77e5\u8bc6\u70b9" : name.trim();
    }

    private String knowledgePointId(String subjectName, String knowledgeName) {
        String subject = firstNonBlank(subjectName, "\u901a\u7528");
        return "kp:" + subject + ":" + knowledgeName;
    }

    private String resolveKnowledgePointId(Transaction tx, String subjectName, String knowledgeName) {
        String fallbackId = knowledgePointId(subjectName, knowledgeName);
        String normalizedName = knowledgeName == null ? "" : knowledgeName.trim().toLowerCase();
        if (isBlank(normalizedName)) {
            return fallbackId;
        }
        List<Record> records = tx.run(
                "MATCH (kp:KnowledgePoint) " +
                        "WHERE (coalesce(kp.subject, '') = $subject OR coalesce(kp.subject, '') = '软考' OR $subject = '通用') " +
                        "  AND (toLower(coalesce(kp.canonicalName, '')) = $name " +
                        "       OR toLower(coalesce(kp.name, '')) = $name " +
                        "       OR any(alias IN coalesce(kp.aliases, []) WHERE toLower(alias) = $name)) " +
                        "RETURN kp.id AS id " +
                        "ORDER BY CASE coalesce(kp.source, '') WHEN 'knowledge_base' THEN 0 WHEN 'manual' THEN 1 ELSE 2 END " +
                        "LIMIT 1",
                Values.parameters(
                        "subject", firstNonBlank(subjectName, "\u901a\u7528"),
                        "name", normalizedName)
        ).list();
        if (records.isEmpty()) {
            return fallbackId;
        }
        return records.get(0).get("id").asString(fallbackId);
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

    private int countBusinessEntityRelations(Map<String, Object> graph) {
        int count = 0;
        for (Map<String, Object> raw : asList(graph.get("relations"))) {
            String source = string(raw.get("subject"));
            String target = string(raw.get("object"));
            if ("business".equals(string(raw.get("relation_category")))
                    && source.startsWith("entity:")
                    && target.startsWith("entity:")
                    && relationTypeFromKgPredicate(string(raw.get("predicate"))) != null
                    && !source.equals(target)) {
                count++;
            }
        }
        return count;
    }

    private String relationTypeFromKgPredicate(String predicate) {
        if (isBlank(predicate)) {
            return null;
        }
        String normalized = predicate.trim().toUpperCase();
        if (AGENT_RELATION_TYPES.contains(normalized)) {
            return normalized;
        }
        String lower = predicate.trim().toLowerCase();
        if (lower.contains("prerequisite") || predicate.contains("前置")) {
            return "PREREQUISITE_OF";
        }
        if (lower.contains("confus") || predicate.contains("易混")) {
            return "CONFUSED_WITH";
        }
        if (lower.contains("contain") || predicate.contains("包含") || predicate.contains("属于")) {
            return "CONTAINS";
        }
        if ("mentioned_in".equals(lower) || "under_heading".equals(lower) || "supported_by".equals(lower)) {
            return null;
        }
        return "RELATED_TO";
    }

    private String firstHeading(Map<String, Object> raw) {
        List<String> headings = stringList(raw.get("heading_path"));
        return headings.isEmpty() ? "" : headings.get(0);
    }

    private String truncate(String value, int limit) {
        if (value == null || value.length() <= limit) {
            return value;
        }
        return value.substring(0, limit);
    }

    private String sanitizeRelationType(String type) {
        if (type == null) {
            return null;
        }
        String normalized = type.trim().toUpperCase();
        return AGENT_RELATION_TYPES.contains(normalized) ? normalized : null;
    }

    private String relationLabel(String type) {
        if ("PREREQUISITE_OF".equals(type)) {
            return "\u524d\u7f6e";
        }
        if ("CONTAINS".equals(type)) {
            return "\u5305\u542b";
        }
        if ("CONFUSED_WITH".equals(type)) {
            return "\u6613\u6df7\u6dc6";
        }
        return "\u5173\u8054";
    }

    private String questionRelationLabel(String type) {
        if ("PENDING_TESTS".equals(type)) {
            return "待确认考查";
        }
        return "考查";
    }

    private String edgeId(String source, String type, String target) {
        return source + "-" + type + "-" + target;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asList(Object value) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (!(value instanceof List)) {
            return result;
        }
        for (Object item : (List<Object>) value) {
            if (item instanceof Map) {
                result.add((Map<String, Object>) item);
            }
        }
        return result;
    }

    private List<String> stringList(Object value) {
        List<String> result = new ArrayList<>();
        if (value instanceof List) {
            for (Object item : (List<?>) value) {
                if (!isBlank(string(item))) {
                    result.add(string(item));
                }
            }
        } else if (!isBlank(string(value))) {
            result.add(string(value));
        }
        return result;
    }

    private String string(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String valueString(Value value, String key, String defaultValue) {
        if (value == null || value.isNull()) {
            return defaultValue;
        }
        Value child = value.get(key);
        if (child == null || child.isNull()) {
            return defaultValue;
        }
        return child.asString(defaultValue);
    }

    private List<String> valueStringList(Value value, String key) {
        if (value == null || value.isNull()) {
            return new ArrayList<>();
        }
        Value child = value.get(key);
        if (child == null || child.isNull()) {
            return new ArrayList<>();
        }
        return child.asList(Value::asString);
    }

    private double number(Object value, double defaultValue) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        try {
            return Double.parseDouble(string(value));
        } catch (Exception ignored) {
            return defaultValue;
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String firstNonBlank(String value, String defaultValue) {
        return isBlank(value) ? defaultValue : value.trim();
    }

    private double clamp(Double value, double min, double max, double defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        return Math.max(min, Math.min(max, value));
    }
}
