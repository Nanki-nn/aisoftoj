package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.KnowledgeBaseDTO;
import com.nan.aisoftoj.dto.KnowledgeBaseRequest;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.service.AuthService;
import com.nan.aisoftoj.service.KnowledgeDocumentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

@RestController
@RequestMapping("/knowledge-bases")
public class KnowledgeBaseController {
    @Autowired
    private KnowledgeDocumentService knowledgeService;
    @Autowired
    private AuthService authService;

    @GetMapping
    public ResultDTO<List<KnowledgeBaseDTO>> list(HttpServletRequest request) {
        return ResultDTO.success(knowledgeService.listBases(userId(request)));
    }

    @PostMapping
    public ResultDTO<KnowledgeBaseDTO> create(
            @Validated @RequestBody KnowledgeBaseRequest body,
            HttpServletRequest request) {
        return ResultDTO.success(knowledgeService.createBase(userId(request), body));
    }

    @PutMapping("/{id}")
    public ResultDTO<KnowledgeBaseDTO> update(
            @PathVariable Long id,
            @Validated @RequestBody KnowledgeBaseRequest body,
            HttpServletRequest request) {
        return ResultDTO.success(knowledgeService.updateBase(userId(request), id, body));
    }

    @DeleteMapping("/{id}")
    public ResultDTO<Void> delete(@PathVariable Long id, HttpServletRequest request) {
        knowledgeService.deleteBase(userId(request), id);
        return ResultDTO.success();
    }

    private Long userId(HttpServletRequest request) {
        return Long.valueOf(authService.getCurrentUserId(request.getHeader("Authorization")));
    }
}
