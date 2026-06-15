package com.nan.aisoftoj.service;

import com.nan.aisoftoj.dto.KnowledgeBaseDTO;
import com.nan.aisoftoj.dto.KnowledgeBaseRequest;
import com.nan.aisoftoj.dto.KnowledgeDocumentDTO;
import com.nan.aisoftoj.dto.KnowledgeDocumentVersionDTO;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

public interface KnowledgeDocumentService {
    List<KnowledgeBaseDTO> listBases(Long userId);
    KnowledgeBaseDTO createBase(Long userId, KnowledgeBaseRequest request);
    KnowledgeBaseDTO updateBase(Long userId, Long id, KnowledgeBaseRequest request);
    void deleteBase(Long userId, Long id);
    KnowledgeDocumentDTO upload(Long userId, Long knowledgeBaseId, MultipartFile file, String optionsJson);
    List<KnowledgeDocumentDTO> list(Long userId, Long knowledgeBaseId);
    KnowledgeDocumentDTO detail(Long userId, Long id);
    KnowledgeDocumentDTO retry(Long userId, Long id, String optionsJson);
    KnowledgeDocumentDTO move(Long userId, Long id, Long knowledgeBaseId);
    void cancel(Long userId, Long id);
    void delete(Long userId, Long id);
    List<KnowledgeDocumentVersionDTO> versions(Long userId, Long id);
    byte[] artifact(Long userId, Long id, Integer version, String kind);
    byte[] original(Long userId, Long id);
    String originalFileName(Long userId, Long id);
    Map<String, Object> capabilities();
    List<String> readyVectorIds(Long userId, List<Long> baseIds);
    void applyCallback(Map<String, Object> payload);
}
