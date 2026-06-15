package com.nan.aisoftoj.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.service.KnowledgeDocumentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

@RestController
@RequestMapping("/internal/knowledge")
public class KnowledgeInternalController {
    @Autowired
    private KnowledgeDocumentService knowledgeService;
    @Autowired
    private ObjectMapper objectMapper;
    @Value("${knowledge.callback.secret:}")
    private String callbackSecret;

    @PostMapping("/callback")
    public ResultDTO<Void> callback(
            @RequestBody String body,
            @RequestHeader(value = "X-Aisoftoj-Signature", defaultValue = "") String signature)
            throws Exception {
        if (!callbackSecret.isEmpty() && !MessageDigest.isEqual(
                signature.getBytes(StandardCharsets.UTF_8),
                sign(body).getBytes(StandardCharsets.UTF_8))) {
            throw new IllegalArgumentException("Invalid callback signature");
        }
        knowledgeService.applyCallback(
                objectMapper.readValue(body, new TypeReference<Map<String, Object>>() {})
        );
        return ResultDTO.success();
    }

    private String sign(String body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(callbackSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] bytes = mac.doFinal(body.getBytes(StandardCharsets.UTF_8));
        StringBuilder result = new StringBuilder();
        for (byte value : bytes) {
            result.append(String.format("%02x", value));
        }
        return result.toString();
    }
}
