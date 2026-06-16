package com.nan.aisoftoj.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nan.aisoftoj.dto.*;
import com.nan.aisoftoj.entity.KnowledgeBase;
import com.nan.aisoftoj.entity.KnowledgeDocument;
import com.nan.aisoftoj.entity.KnowledgeDocumentVersion;
import com.nan.aisoftoj.mapper.KnowledgeBaseMapper;
import com.nan.aisoftoj.mapper.KnowledgeDocumentMapper;
import com.nan.aisoftoj.mapper.KnowledgeDocumentVersionMapper;
import com.nan.aisoftoj.mapper.AiChatSessionKnowledgeBaseMapper;
import com.nan.aisoftoj.service.KnowledgeDocumentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class KnowledgeDocumentServiceImpl implements KnowledgeDocumentService {
    private static final Set<String> ALLOWED_EXTENSIONS = new HashSet<>(Arrays.asList(
            "pdf", "png", "jpg", "jpeg", "webp", "docx", "pptx", "xlsx", "txt", "md", "markdown"
    ));
    private static final Set<String> ACTIVE_STATUSES = new HashSet<>(Arrays.asList(
            "uploaded", "queued", "parsing", "normalizing", "chunking", "embedding", "indexing"
    ));

    @Autowired private KnowledgeBaseMapper baseMapper;
    @Autowired private KnowledgeDocumentMapper documentMapper;
    @Autowired private KnowledgeDocumentVersionMapper versionMapper;
    @Autowired private AiChatSessionKnowledgeBaseMapper chatBaseMapper;
    @Autowired private ObjectMapper objectMapper;
    @Value("${ai-service.url:http://localhost:8090}") private String aiServiceUrl;
    @Value("${ai-service.secret:}") private String aiServiceSecret;
    @Value("${knowledge.upload.path:./uploads/knowledge/}") private String uploadPath;
    @Value("${knowledge.max-file-size:209715200}") private long maxFileSize;

    @Override
    public List<KnowledgeBaseDTO> listBases(Long userId) {
        ensureDefaultBase(userId);
        List<KnowledgeBaseDTO> result = new ArrayList<>();
        for (KnowledgeBase base : baseMapper.selectList(new LambdaQueryWrapper<KnowledgeBase>()
                .eq(KnowledgeBase::getUserId, userId)
                .orderByDesc(KnowledgeBase::getIsDefault)
                .orderByDesc(KnowledgeBase::getUpdateTime))) {
            result.add(toBaseDTO(base));
        }
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KnowledgeBaseDTO createBase(Long userId, KnowledgeBaseRequest request) {
        KnowledgeBase base = new KnowledgeBase();
        base.setUserId(userId);
        base.setVectorId("kb-" + UUID.randomUUID());
        base.setName(request.getName().trim());
        base.setDescription(trim(request.getDescription()));
        base.setColor(defaultColor(request.getColor()));
        base.setIsDefault(0);
        base.setCreateTime(LocalDateTime.now());
        base.setUpdateTime(LocalDateTime.now());
        base.setIsDeleted(0);
        baseMapper.insert(base);
        return toBaseDTO(base);
    }

    @Override
    public KnowledgeBaseDTO updateBase(Long userId, Long id, KnowledgeBaseRequest request) {
        KnowledgeBase base = requireBase(userId, id);
        base.setName(request.getName().trim());
        base.setDescription(trim(request.getDescription()));
        base.setColor(defaultColor(request.getColor()));
        base.setUpdateTime(LocalDateTime.now());
        baseMapper.updateById(base);
        return toBaseDTO(base);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteBase(Long userId, Long id) {
        KnowledgeBase base = requireBase(userId, id);
        if (Integer.valueOf(1).equals(base.getIsDefault())) {
            throw new IllegalArgumentException("默认知识库不能删除");
        }
        for (KnowledgeDocument document : documentMapper.selectList(
                new LambdaQueryWrapper<KnowledgeDocument>()
                        .eq(KnowledgeDocument::getUserId, userId)
                        .eq(KnowledgeDocument::getKnowledgeBaseRefId, id))) {
            delete(userId, document.getId());
        }
        chatBaseMapper.delete(
                new LambdaQueryWrapper<com.nan.aisoftoj.entity.AiChatSessionKnowledgeBase>()
                        .eq(com.nan.aisoftoj.entity.AiChatSessionKnowledgeBase::getKnowledgeBaseId, id)
        );
        baseMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KnowledgeDocumentDTO upload(
            Long userId, Long knowledgeBaseId, MultipartFile file, String optionsJson) {
        KnowledgeBase base = requireBase(userId, knowledgeBaseId);
        validate(file);
        Map<String, Object> options = validateOptions(optionsJson);
        String originalName = safeFileName(file.getOriginalFilename());
        String externalId = UUID.randomUUID().toString();
        Path target = storageDirectory(userId).resolve(externalId + "." + extensionOf(originalName));
        try {
            Files.createDirectories(target.getParent());
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new IllegalStateException("文档保存失败", exception);
        }

        KnowledgeDocument document = new KnowledgeDocument();
        document.setUserId(userId);
        document.setKnowledgeBaseRefId(base.getId());
        document.setKnowledgeBaseId(base.getVectorId());
        document.setDocumentId(externalId);
        document.setFileName(originalName);
        document.setFileType(extensionOf(originalName).toUpperCase());
        document.setFileSize(file.getSize());
        document.setStoragePath(target.toAbsolutePath().normalize().toString());
        document.setStatus("uploaded");
        document.setChunkCount(0);
        document.setVersion(1);
        document.setCreateTime(LocalDateTime.now());
        document.setUpdateTime(LocalDateTime.now());
        document.setIsDeleted(0);
        documentMapper.insert(document);
        KnowledgeDocumentVersion version = createVersion(document, 1, options);
        submit(document, version);
        return toDocumentDTO(document, base, version, null);
    }

    @Override
    public List<KnowledgeDocumentDTO> list(Long userId, Long knowledgeBaseId) {
        ensureDefaultBase(userId);
        LambdaQueryWrapper<KnowledgeDocument> query = new LambdaQueryWrapper<KnowledgeDocument>()
                .eq(KnowledgeDocument::getUserId, userId)
                .orderByDesc(KnowledgeDocument::getCreateTime);
        if (knowledgeBaseId != null) query.eq(KnowledgeDocument::getKnowledgeBaseRefId, knowledgeBaseId);
        List<KnowledgeDocumentDTO> result = new ArrayList<>();
        for (KnowledgeDocument document : documentMapper.selectList(query)) {
            KnowledgeBase base = requireBase(userId, document.getKnowledgeBaseRefId());
            result.add(toDocumentDTO(document, base, currentVersion(document), null));
        }
        return result;
    }

    @Override
    public KnowledgeDocumentDTO detail(Long userId, Long id) {
        KnowledgeDocument document = requireDocument(userId, id);
        return toDocumentDTO(document, requireBase(userId, document.getKnowledgeBaseRefId()),
                currentVersion(document), versions(userId, id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KnowledgeDocumentDTO retry(Long userId, Long id, String optionsJson) {
        KnowledgeDocument document = requireDocument(userId, id);
        if (!Files.exists(Paths.get(document.getStoragePath()))) {
            throw new IllegalArgumentException("原始文档不存在，请重新上传");
        }
        KnowledgeDocumentVersion current = currentVersion(document);
        Map<String, Object> options = optionsJson == null || optionsJson.trim().isEmpty()
                ? parseOptions(current.getOptionsJson()) : validateOptions(optionsJson);
        int next = document.getVersion() + 1;
        document.setVersion(next);
        document.setStatus("uploaded");
        document.setChunkCount(0);
        document.setErrorMessage(null);
        document.setUpdateTime(LocalDateTime.now());
        documentMapper.updateById(document);
        KnowledgeDocumentVersion version = createVersion(document, next, options);
        submit(document, version);
        return toDocumentDTO(document, requireBase(userId, document.getKnowledgeBaseRefId()),
                version, null);
    }

    @Override
    public KnowledgeDocumentDTO move(Long userId, Long id, Long knowledgeBaseId) {
        KnowledgeDocument document = requireDocument(userId, id);
        KnowledgeBase base = requireBase(userId, knowledgeBaseId);
        if (ACTIVE_STATUSES.contains(document.getStatus())) {
            throw new IllegalArgumentException("Cancel the running document before moving it");
        }
        if ("ready".equals(document.getStatus())) {
            Map<String, Object> body = new HashMap<>();
            body.put("knowledgeBaseId", base.getVectorId());
            callJson("/api/v1/index/documents/" + document.getDocumentId()
                    + "/knowledge-base", "PATCH",
                    writeJson(body).getBytes(StandardCharsets.UTF_8));
        }
        document.setKnowledgeBaseRefId(base.getId());
        document.setKnowledgeBaseId(base.getVectorId());
        document.setUpdateTime(LocalDateTime.now());
        documentMapper.updateById(document);
        return toDocumentDTO(document, base, currentVersion(document), null);
    }

    @Override
    public void cancel(Long userId, Long id) {
        KnowledgeDocument document = requireDocument(userId, id);
        KnowledgeDocumentVersion version = currentVersion(document);
        if (!ACTIVE_STATUSES.contains(version.getStatus())) return;
        callJson("/api/v1/index/jobs/" + version.getAiJobId() + "/cancel", "POST", null);
        updateVersionFromPayload(document, version, singleton("status", "cancelled"));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long userId, Long id) {
        KnowledgeDocument document = requireDocument(userId, id);
        if (ACTIVE_STATUSES.contains(document.getStatus())) cancel(userId, id);
        callQuietly("/api/v1/index/documents/" + document.getDocumentId(), "DELETE");
        versionMapper.delete(new LambdaQueryWrapper<KnowledgeDocumentVersion>()
                .eq(KnowledgeDocumentVersion::getDocumentId, document.getId()));
        documentMapper.deleteById(document.getId());
        try { Files.deleteIfExists(Paths.get(document.getStoragePath())); } catch (IOException ignored) { }
    }

    @Override
    public List<KnowledgeDocumentVersionDTO> versions(Long userId, Long id) {
        KnowledgeDocument document = requireDocument(userId, id);
        List<KnowledgeDocumentVersionDTO> result = new ArrayList<>();
        for (KnowledgeDocumentVersion version : versionMapper.selectList(
                new LambdaQueryWrapper<KnowledgeDocumentVersion>()
                        .eq(KnowledgeDocumentVersion::getDocumentId, document.getId())
                        .orderByDesc(KnowledgeDocumentVersion::getVersion))) {
            result.add(toVersionDTO(version));
        }
        return result;
    }

    @Override
    public byte[] artifact(Long userId, Long id, Integer version, String kind) {
        KnowledgeDocument document = requireDocument(userId, id);
        return callBytes("/api/v1/index/documents/" + document.getDocumentId()
                + "/versions/" + version + "/artifacts/" + kind);
    }

    @Override
    public byte[] asset(Long userId, String documentId, Integer version, String filename) {
        requireDocumentByExternalId(userId, documentId);
        String safeName = Paths.get(filename).getFileName().toString();
        if (!safeName.equals(filename)) throw new IllegalArgumentException("非法图片名称");
        return callBytes("/api/v1/index/documents/" + documentId
                + "/versions/" + version + "/assets/" + safeName);
    }

    @Override
    public byte[] original(Long userId, Long id) {
        try { return Files.readAllBytes(Paths.get(requireDocument(userId, id).getStoragePath())); }
        catch (IOException exception) { throw new IllegalStateException("原始文档读取失败", exception); }
    }

    @Override
    public String originalFileName(Long userId, Long id) {
        return requireDocument(userId, id).getFileName();
    }

    @Override
    public Map<String, Object> capabilities() {
        Map<String, Object> capabilities = new LinkedHashMap<>(
                callJson("/api/v1/index/capabilities", "GET", null));
        capabilities.put("maxFileSize", maxFileSize);
        return capabilities;
    }

    @Override
    public List<String> readyVectorIds(Long userId, List<Long> baseIds) {
        if (baseIds == null || baseIds.isEmpty()) {
            return Collections.emptyList();
        }
        LambdaQueryWrapper<KnowledgeBase> query = new LambdaQueryWrapper<KnowledgeBase>()
                .eq(KnowledgeBase::getUserId, userId)
                .in(KnowledgeBase::getId, baseIds);
        List<String> result = new ArrayList<>();
        for (KnowledgeBase base : baseMapper.selectList(query)) {
            Long count = documentMapper.selectCount(new LambdaQueryWrapper<KnowledgeDocument>()
                    .eq(KnowledgeDocument::getUserId, userId)
                    .eq(KnowledgeDocument::getKnowledgeBaseRefId, base.getId())
                    .eq(KnowledgeDocument::getStatus, "ready"));
            if (count != null && count > 0) result.add(base.getVectorId());
        }
        return result;
    }

    @Override
    public void applyCallback(Map<String, Object> payload) {
        String externalId = string(payload.get("documentId"));
        Integer versionNumber = integer(payload.get("version"));
        if (externalId == null || versionNumber == null) return;
        KnowledgeDocument document = documentMapper.selectOne(
                new LambdaQueryWrapper<KnowledgeDocument>()
                        .eq(KnowledgeDocument::getDocumentId, externalId).last("LIMIT 1"));
        if (document == null) return;
        KnowledgeDocumentVersion version = versionMapper.selectOne(
                new LambdaQueryWrapper<KnowledgeDocumentVersion>()
                        .eq(KnowledgeDocumentVersion::getDocumentId, document.getId())
                        .eq(KnowledgeDocumentVersion::getVersion, versionNumber).last("LIMIT 1"));
        if (version != null) updateVersionFromPayload(document, version, payload);
    }

    @Scheduled(fixedDelayString = "${knowledge.poll-interval-ms:10000}")
    public void reconcileActiveVersions() {
        for (KnowledgeDocumentVersion version : versionMapper.selectList(
                new LambdaQueryWrapper<KnowledgeDocumentVersion>()
                        .in(KnowledgeDocumentVersion::getStatus, ACTIVE_STATUSES))) {
            try {
                KnowledgeDocument document = documentMapper.selectById(version.getDocumentId());
                if (document == null || version.getAiJobId() == null) continue;
                Map<String, Object> payload = callJson(
                        "/api/v1/index/jobs/" + version.getAiJobId(), "GET", null);
                Map<String, Object> progress = asMap(payload.get("progress"));
                if (!progress.isEmpty()) updateVersionFromPayload(document, version, progress);
                Map<String, Object> result = asMap(payload.get("result"));
                if (!result.isEmpty()) updateVersionFromPayload(document, version, result);
                if ("failed".equals(string(payload.get("status")))) {
                    progress.put("status", "failed");
                    progress.put("error", payload.get("error"));
                    updateVersionFromPayload(document, version, progress);
                }
            } catch (Exception ignored) { }
        }
    }

    private KnowledgeBase ensureDefaultBase(Long userId) {
        KnowledgeBase existing = baseMapper.selectOne(new LambdaQueryWrapper<KnowledgeBase>()
                .eq(KnowledgeBase::getUserId, userId)
                .eq(KnowledgeBase::getIsDefault, 1).last("LIMIT 1"));
        if (existing != null) return existing;
        KnowledgeBase base = new KnowledgeBase();
        base.setUserId(userId);
        base.setVectorId("user-" + userId);
        base.setName("个人知识库");
        base.setDescription("默认存放个人备考资料");
        base.setColor("teal");
        base.setIsDefault(1);
        base.setCreateTime(LocalDateTime.now());
        base.setUpdateTime(LocalDateTime.now());
        base.setIsDeleted(0);
        baseMapper.insert(base);
        return base;
    }

    private KnowledgeDocumentVersion createVersion(
            KnowledgeDocument document, int number, Map<String, Object> options) {
        KnowledgeDocumentVersion version = new KnowledgeDocumentVersion();
        version.setDocumentId(document.getId());
        version.setVersion(number);
        version.setStatus("uploaded");
        version.setProgress(5);
        version.setChunkCount(0);
        version.setOptionsJson(writeJson(options));
        version.setCreateTime(LocalDateTime.now());
        version.setUpdateTime(LocalDateTime.now());
        versionMapper.insert(version);
        return version;
    }

    private void submit(KnowledgeDocument document, KnowledgeDocumentVersion version) {
        try {
            Map<String, Object> response = uploadToAi(document, version);
            version.setAiJobId(string(response.get("job_id")));
            version.setStatus("queued");
            version.setProgress(10);
            document.setStatus("queued");
            document.setErrorMessage(null);
        } catch (Exception exception) {
            version.setStatus("failed");
            version.setErrorMessage(message(exception));
            document.setStatus("failed");
            document.setErrorMessage(message(exception));
        }
        version.setUpdateTime(LocalDateTime.now());
        document.setUpdateTime(LocalDateTime.now());
        versionMapper.updateById(version);
        documentMapper.updateById(document);
    }

    private Map<String, Object> uploadToAi(
            KnowledgeDocument document, KnowledgeDocumentVersion version) throws Exception {
        String boundary = "----Aisoftoj" + UUID.randomUUID().toString().replace("-", "");
        HttpURLConnection connection = connection("/api/v1/index/jobs/upload", "POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
        try (OutputStream output = connection.getOutputStream();
             BufferedWriter writer = new BufferedWriter(
                     new OutputStreamWriter(output, StandardCharsets.UTF_8))) {
            writeField(writer, boundary, "knowledge_base_id", document.getKnowledgeBaseId());
            writeField(writer, boundary, "document_id", document.getDocumentId());
            writeField(writer, boundary, "version", String.valueOf(version.getVersion()));
            writeField(writer, boundary, "options_json", version.getOptionsJson());
            writer.write("--" + boundary + "\r\n");
            writer.write("Content-Disposition: form-data; name=\"file\"; filename=\""
                    + document.getFileName().replace("\"", "") + "\"\r\n");
            writer.write("Content-Type: application/octet-stream\r\n\r\n");
            writer.flush();
            Files.copy(Paths.get(document.getStoragePath()), output);
            output.flush();
            writer.write("\r\n--" + boundary + "--\r\n");
            writer.flush();
        }
        return readJson(connection);
    }

    private void updateVersionFromPayload(
            KnowledgeDocument document,
            KnowledgeDocumentVersion version,
            Map<String, Object> payload) {
        String status = string(payload.get("status"));
        if (status == null) return;
        version.setStatus(status);
        version.setProgress(progressFor(status));
        version.setQueuedAhead(integer(payload.get("queuedAhead")));
        if (version.getQueuedAhead() == null) version.setQueuedAhead(integer(payload.get("queued_ahead")));
        if (payload.get("mineruTaskId") != null) version.setMineruTaskId(string(payload.get("mineruTaskId")));
        if (payload.get("mineru_task_id") != null) version.setMineruTaskId(string(payload.get("mineru_task_id")));
        if (payload.get("chunkCount") != null) version.setChunkCount(integer(payload.get("chunkCount")));
        if (payload.get("error") != null) version.setErrorMessage(string(payload.get("error")));
        if (payload.get("traceId") != null) version.setTraceId(string(payload.get("traceId")));
        if (payload.get("failureType") != null) version.setFailureType(string(payload.get("failureType")));
        if (payload.get("stageDurationMs") != null) {
            version.setStageDurationMs(longValue(payload.get("stageDurationMs")));
        }
        if (payload.get("totalDurationMs") != null) {
            version.setTotalDurationMs(longValue(payload.get("totalDurationMs")));
        }
        version.setMarkdownPath(stringOrExisting(payload.get("markdownPath"), version.getMarkdownPath()));
        version.setContentListPath(stringOrExisting(payload.get("contentListPath"), version.getContentListPath()));
        version.setRawResultPath(stringOrExisting(payload.get("rawResultPath"), version.getRawResultPath()));
        version.setChunksPath(stringOrExisting(payload.get("chunksPath"), version.getChunksPath()));
        if (version.getStartedTime() == null && !"queued".equals(status) && !"uploaded".equals(status)) {
            version.setStartedTime(LocalDateTime.now());
        }
        if (Arrays.asList("ready", "failed", "cancelled").contains(status)) {
            version.setCompletedTime(LocalDateTime.now());
        }
        version.setUpdateTime(LocalDateTime.now());
        versionMapper.updateById(version);
        if (version.getVersion().equals(document.getVersion())) {
            document.setStatus(status);
            document.setChunkCount(version.getChunkCount() == null ? 0 : version.getChunkCount());
            document.setErrorMessage(version.getErrorMessage());
            document.setJobId(version.getAiJobId());
            document.setUpdateTime(LocalDateTime.now());
            documentMapper.updateById(document);
        }
    }

    private KnowledgeBaseDTO toBaseDTO(KnowledgeBase base) {
        KnowledgeBaseDTO dto = new KnowledgeBaseDTO();
        dto.setId(base.getId());
        dto.setName(base.getName());
        dto.setDescription(base.getDescription());
        dto.setColor(base.getColor());
        dto.setIsDefault(Integer.valueOf(1).equals(base.getIsDefault()));
        dto.setDocumentCount(countDocuments(base.getId(), null));
        dto.setReadyCount(countDocuments(base.getId(), "ready"));
        dto.setCreateTime(base.getCreateTime());
        dto.setUpdateTime(base.getUpdateTime());
        return dto;
    }

    private int countDocuments(Long baseId, String status) {
        LambdaQueryWrapper<KnowledgeDocument> query = new LambdaQueryWrapper<KnowledgeDocument>()
                .eq(KnowledgeDocument::getKnowledgeBaseRefId, baseId);
        if (status != null) query.eq(KnowledgeDocument::getStatus, status);
        Long count = documentMapper.selectCount(query);
        return count == null ? 0 : count.intValue();
    }

    private KnowledgeDocumentDTO toDocumentDTO(
            KnowledgeDocument document, KnowledgeBase base,
            KnowledgeDocumentVersion version, List<KnowledgeDocumentVersionDTO> history) {
        KnowledgeDocumentDTO dto = new KnowledgeDocumentDTO();
        dto.setId(document.getId());
        dto.setDocumentId(document.getDocumentId());
        dto.setKnowledgeBaseId(base.getId());
        dto.setKnowledgeBaseName(base.getName());
        dto.setFileName(document.getFileName());
        dto.setFileType(document.getFileType());
        dto.setFileSize(document.getFileSize());
        dto.setStatus(version.getStatus());
        dto.setChunkCount(version.getChunkCount());
        dto.setErrorMessage(version.getErrorMessage());
        dto.setVersion(version.getVersion());
        dto.setProgress(version.getProgress());
        dto.setQueuedAhead(version.getQueuedAhead());
        dto.setOptions(parseOptions(version.getOptionsJson()));
        dto.setVersions(history);
        dto.setCreateTime(document.getCreateTime());
        dto.setUpdateTime(version.getUpdateTime());
        return dto;
    }

    private KnowledgeDocumentVersionDTO toVersionDTO(KnowledgeDocumentVersion version) {
        KnowledgeDocumentVersionDTO dto = new KnowledgeDocumentVersionDTO();
        dto.setId(version.getId());
        dto.setVersion(version.getVersion());
        dto.setStatus(version.getStatus());
        dto.setProgress(version.getProgress());
        dto.setQueuedAhead(version.getQueuedAhead());
        dto.setChunkCount(version.getChunkCount());
        dto.setErrorMessage(version.getErrorMessage());
        dto.setMineruTaskId(version.getMineruTaskId());
        dto.setTraceId(version.getTraceId());
        dto.setFailureType(version.getFailureType());
        dto.setStageDurationMs(version.getStageDurationMs());
        dto.setTotalDurationMs(version.getTotalDurationMs());
        dto.setOptions(parseOptions(version.getOptionsJson()));
        dto.setStartedTime(version.getStartedTime());
        dto.setCompletedTime(version.getCompletedTime());
        dto.setCreateTime(version.getCreateTime());
        dto.setUpdateTime(version.getUpdateTime());
        return dto;
    }

    private KnowledgeBase requireBase(Long userId, Long id) {
        if (id == null) throw new IllegalArgumentException("请选择知识库");
        KnowledgeBase base = baseMapper.selectOne(new LambdaQueryWrapper<KnowledgeBase>()
                .eq(KnowledgeBase::getId, id).eq(KnowledgeBase::getUserId, userId).last("LIMIT 1"));
        if (base == null) throw new IllegalArgumentException("知识库不存在或无权访问");
        return base;
    }

    private KnowledgeDocument requireDocument(Long userId, Long id) {
        KnowledgeDocument document = documentMapper.selectOne(
                new LambdaQueryWrapper<KnowledgeDocument>()
                        .eq(KnowledgeDocument::getId, id)
                        .eq(KnowledgeDocument::getUserId, userId).last("LIMIT 1"));
        if (document == null) throw new IllegalArgumentException("文档不存在或无权访问");
        return document;
    }

    private KnowledgeDocument requireDocumentByExternalId(Long userId, String documentId) {
        KnowledgeDocument document = documentMapper.selectOne(
                new LambdaQueryWrapper<KnowledgeDocument>()
                        .eq(KnowledgeDocument::getDocumentId, documentId)
                        .eq(KnowledgeDocument::getUserId, userId).last("LIMIT 1"));
        if (document == null) throw new IllegalArgumentException("文档不存在或无权访问");
        return document;
    }

    private KnowledgeDocumentVersion currentVersion(KnowledgeDocument document) {
        KnowledgeDocumentVersion version = versionMapper.selectOne(
                new LambdaQueryWrapper<KnowledgeDocumentVersion>()
                        .eq(KnowledgeDocumentVersion::getDocumentId, document.getId())
                        .eq(KnowledgeDocumentVersion::getVersion, document.getVersion()).last("LIMIT 1"));
        if (version == null) throw new IllegalStateException("文档版本记录缺失");
        return version;
    }

    private Map<String, Object> validateOptions(String json) {
        Map<String, Object> options = parseOptions(json);
        int size = integer(options.get("chunk_size")) == null ? 600 : integer(options.get("chunk_size"));
        int overlap = integer(options.get("chunk_overlap")) == null ? 100 : integer(options.get("chunk_overlap"));
        if (size < 100 || size > 4000 || overlap < 0 || overlap >= size) {
            throw new IllegalArgumentException("切块大小必须为 100-4000，重叠长度必须小于切块大小");
        }
        options.put("chunk_size", size);
        options.put("chunk_overlap", overlap);
        return options;
    }

    private Map<String, Object> parseOptions(String json) {
        try {
            if (json == null || json.trim().isEmpty()) json = "{}";
            Map<String, Object> result = objectMapper.readValue(
                    json, new TypeReference<Map<String, Object>>() {});
            if (!result.containsKey("backend")) result.put("backend", "hybrid-engine");
            if (!result.containsKey("effort")) result.put("effort", "medium");
            if (!result.containsKey("parse_method")) result.put("parse_method", "auto");
            if (!result.containsKey("lang_list")) result.put("lang_list", Collections.singletonList("ch"));
            if (!result.containsKey("formula_enable")) result.put("formula_enable", true);
            if (!result.containsKey("table_enable")) result.put("table_enable", true);
            if (!result.containsKey("image_analysis")) result.put("image_analysis", false);
            if (!result.containsKey("return_images")) result.put("return_images", true);
            return result;
        } catch (Exception exception) {
            throw new IllegalArgumentException("解析参数格式错误");
        }
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("请选择文件");
        if (file.getSize() > maxFileSize) {
            throw new IllegalArgumentException(
                    "文件大小不能超过 " + formatFileSize(maxFileSize));
        }
        String extension = extensionOf(safeFileName(file.getOriginalFilename()));
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException(
                    "支持 PDF、图片、DOCX、PPTX、XLSX、TXT、Markdown；DOC/PPT 请先转换");
        }
    }

    private String formatFileSize(long bytes) {
        long megabytes = bytes / (1024L * 1024L);
        return megabytes > 0 ? megabytes + "MB" : bytes + "B";
    }

    private HttpURLConnection connection(String path, String method) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(baseUrl() + path).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(10_000);
        connection.setReadTimeout(30_000);
        if (aiServiceSecret != null && !aiServiceSecret.isEmpty()) {
            connection.setRequestProperty("X-Aisoftoj-Internal-Secret", aiServiceSecret);
        }
        return connection;
    }

    private Map<String, Object> callJson(String path, String method, byte[] body) {
        try {
            HttpURLConnection connection = connection(path, method);
            if (body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                try (OutputStream output = connection.getOutputStream()) { output.write(body); }
            }
            return readJson(connection);
        } catch (Exception exception) {
            throw new IllegalStateException("AI 服务请求失败: " + message(exception), exception);
        }
    }

    private byte[] callBytes(String path) {
        try {
            HttpURLConnection connection = connection(path, "GET");
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IllegalStateException("状态码 " + status);
            try (InputStream input = connection.getInputStream();
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
                return output.toByteArray();
            }
        } catch (Exception exception) {
            throw new IllegalStateException("解析产物读取失败: " + message(exception), exception);
        }
    }

    private Map<String, Object> readJson(HttpURLConnection connection) throws IOException {
        int status = connection.getResponseCode();
        InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        StringBuilder json = new StringBuilder();
        if (stream != null) {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) json.append(line);
            }
        }
        connection.disconnect();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("AI 服务返回状态码 " + status + ": " + json);
        }
        if (json.length() == 0) return new HashMap<>();
        return objectMapper.readValue(json.toString(), new TypeReference<Map<String, Object>>() {});
    }

    private void callQuietly(String path, String method) {
        try { callJson(path, method, null); } catch (Exception ignored) { }
    }

    private void writeField(BufferedWriter writer, String boundary, String name, String value)
            throws IOException {
        writer.write("--" + boundary + "\r\n");
        writer.write("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n");
        writer.write(value + "\r\n");
        writer.flush();
    }

    private Path storageDirectory(Long userId) {
        return Paths.get(uploadPath).toAbsolutePath().normalize().resolve(String.valueOf(userId));
    }

    private String safeFileName(String name) {
        String safe = name == null ? "document" : Paths.get(name).getFileName().toString();
        return safe.trim().isEmpty() ? "document" : safe;
    }
    private String extensionOf(String name) {
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase();
    }
    private String baseUrl() { return aiServiceUrl.replaceAll("/+$", ""); }
    private String trim(String value) { return value == null ? null : value.trim(); }
    private String defaultColor(String value) { return value == null || value.trim().isEmpty() ? "teal" : value; }
    private String message(Exception exception) {
        return exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage();
    }
    private String writeJson(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (Exception exception) { throw new IllegalArgumentException("参数序列化失败"); }
    }
    private String string(Object value) { return value == null ? null : String.valueOf(value); }
    private String stringOrExisting(Object value, String existing) {
        return value == null ? existing : String.valueOf(value);
    }
    private Integer integer(Object value) {
        if (value == null || "None".equals(String.valueOf(value)) || "null".equals(String.valueOf(value))) return null;
        if (value instanceof Number) return ((Number) value).intValue();
        try { return Integer.valueOf(String.valueOf(value)); } catch (Exception ignored) { return null; }
    }
    private Long longValue(Object value) {
        if (value == null || "None".equals(String.valueOf(value)) || "null".equals(String.valueOf(value))) return null;
        if (value instanceof Number) return ((Number) value).longValue();
        try { return Long.valueOf(String.valueOf(value)); } catch (Exception ignored) { return null; }
    }
    private int progressFor(String status) {
        if ("uploaded".equals(status)) return 5;
        if ("queued".equals(status)) return 10;
        if ("parsing".equals(status)) return 30;
        if ("normalizing".equals(status)) return 55;
        if ("chunking".equals(status)) return 65;
        if ("embedding".equals(status)) return 75;
        if ("indexing".equals(status)) return 90;
        if ("ready".equals(status)) return 100;
        return 0;
    }
    private Map<String, Object> singleton(String key, Object value) {
        Map<String, Object> map = new HashMap<>();
        map.put(key, value);
        return map;
    }
    private Map<String, Object> asMap(Object value) {
        if (!(value instanceof Map)) return new HashMap<>();
        Map<String, Object> result = new HashMap<>();
        for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
            result.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        return result;
    }
}
