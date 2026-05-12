package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.service.AuthService;
import com.nan.aisoftoj.service.OssService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@RestController
@RequestMapping("/oss")
public class OssController {

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024L; // 10MB
    private static final Set<String> ALLOWED_TYPES = new HashSet<>(Arrays.asList(
            "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"
    ));

    @Autowired
    private OssService ossService;

    @Autowired
    private AuthService authService;

    @PostMapping("/upload")
    public ResultDTO<String> upload(HttpServletRequest request,
                                    @RequestParam("file") MultipartFile file,
                                    @RequestParam(value = "dir", required = false) String dir) {
        authService.getCurrentUserId(request.getHeader("Authorization"));

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("文件不能为空");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("文件大小不能超过 10MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("仅支持上传图片文件（JPG/PNG/GIF/WebP/SVG）");
        }

        String url = ossService.upload(file, dir);
        return ResultDTO.success(url);
    }
}
