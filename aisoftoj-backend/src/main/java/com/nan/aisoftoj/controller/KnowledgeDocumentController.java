package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.KnowledgeDocumentDTO;
import com.nan.aisoftoj.dto.KnowledgeDocumentVersionDTO;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.service.AuthService;
import com.nan.aisoftoj.service.KnowledgeDocumentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/knowledge/documents")
public class KnowledgeDocumentController {
    @Autowired
    private KnowledgeDocumentService documentService;
    @Autowired
    private AuthService authService;

    @PostMapping
    public ResultDTO<KnowledgeDocumentDTO> upload(
            @RequestParam("knowledgeBaseId") Long knowledgeBaseId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "options", defaultValue = "{}") String options,
            HttpServletRequest request) {
        return ResultDTO.success(
                "文档已提交解析",
                documentService.upload(userId(request), knowledgeBaseId, file, options)
        );
    }

    @GetMapping
    public ResultDTO<List<KnowledgeDocumentDTO>> list(
            @RequestParam(value = "knowledgeBaseId", required = false) Long knowledgeBaseId,
            HttpServletRequest request) {
        return ResultDTO.success(documentService.list(userId(request), knowledgeBaseId));
    }

    @GetMapping("/{id}")
    public ResultDTO<KnowledgeDocumentDTO> detail(@PathVariable Long id, HttpServletRequest request) {
        return ResultDTO.success(documentService.detail(userId(request), id));
    }

    @PostMapping("/{id}/retry")
    public ResultDTO<KnowledgeDocumentDTO> retry(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> options,
            HttpServletRequest request) throws Exception {
        String json = options == null ? null : new com.fasterxml.jackson.databind.ObjectMapper()
                .writeValueAsString(options);
        return ResultDTO.success(documentService.retry(userId(request), id, json));
    }

    @PostMapping("/{id}/cancel")
    public ResultDTO<Void> cancel(@PathVariable Long id, HttpServletRequest request) {
        documentService.cancel(userId(request), id);
        return ResultDTO.success();
    }

    @PostMapping("/{id}/extract-graph")
    public ResultDTO<KnowledgeDocumentDTO> extractGraph(
            @PathVariable Long id,
            HttpServletRequest request) {
        return ResultDTO.success(
                "知识图谱抽取已提交",
                documentService.extractKnowledgeGraph(userId(request), id)
        );
    }

    @DeleteMapping("/{id}/graph")
    public ResultDTO<KnowledgeDocumentDTO> deleteGraph(
            @PathVariable Long id,
            HttpServletRequest request) {
        return ResultDTO.success(documentService.deleteKnowledgeGraph(userId(request), id));
    }

    @PostMapping("/{id}/delete-graph")
    public ResultDTO<KnowledgeDocumentDTO> deleteGraphCompat(
            @PathVariable Long id,
            HttpServletRequest request) {
        return ResultDTO.success(documentService.deleteKnowledgeGraph(userId(request), id));
    }

    @PatchMapping("/{id}/move")
    public ResultDTO<KnowledgeDocumentDTO> move(
            @PathVariable Long id,
            @RequestBody Map<String, Long> body,
            HttpServletRequest request) {
        return ResultDTO.success(
                documentService.move(userId(request), id, body.get("knowledgeBaseId"))
        );
    }

    @GetMapping("/{id}/versions")
    public ResultDTO<List<KnowledgeDocumentVersionDTO>> versions(
            @PathVariable Long id,
            HttpServletRequest request) {
        return ResultDTO.success(documentService.versions(userId(request), id));
    }

    @GetMapping("/{id}/versions/{version}/artifacts/{kind}")
    public ResponseEntity<byte[]> artifact(
            @PathVariable Long id,
            @PathVariable Integer version,
            @PathVariable String kind,
            HttpServletRequest request) {
        MediaType mediaType = "markdown".equals(kind)
                ? MediaType.parseMediaType("text/markdown;charset=UTF-8")
                : MediaType.APPLICATION_JSON;
        return ResponseEntity.ok().contentType(mediaType)
                .body(documentService.artifact(userId(request), id, version, kind));
    }

    @GetMapping("/{id}/original")
    public ResponseEntity<byte[]> original(@PathVariable Long id, HttpServletRequest request) {
        Long userId = userId(request);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename(documentService.originalFileName(userId, id), StandardCharsets.UTF_8)
                .build());
        return ResponseEntity.ok().headers(headers)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(documentService.original(userId, id));
    }

    @GetMapping("/external/{documentId}/versions/{version}/assets/{filename:.+}")
    public ResponseEntity<byte[]> asset(
            @PathVariable String documentId,
            @PathVariable Integer version,
            @PathVariable String filename,
            HttpServletRequest request) {
        MediaType mediaType = MediaTypeFactory.getMediaType(filename)
                .orElse(MediaType.APPLICATION_OCTET_STREAM);
        return ResponseEntity.ok()
                .contentType(mediaType)
                .body(documentService.asset(
                        userId(request), documentId, version, filename));
    }

    @DeleteMapping("/{id}")
    public ResultDTO<Void> delete(@PathVariable Long id, HttpServletRequest request) {
        documentService.delete(userId(request), id);
        return ResultDTO.success();
    }

    @GetMapping("/capabilities")
    public ResultDTO<Map<String, Object>> capabilities() {
        return ResultDTO.success(documentService.capabilities());
    }

    private Long userId(HttpServletRequest request) {
        return Long.valueOf(authService.getCurrentUserId(request.getHeader("Authorization")));
    }
}
