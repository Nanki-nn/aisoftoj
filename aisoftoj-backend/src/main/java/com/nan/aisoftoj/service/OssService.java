package com.nan.aisoftoj.service;

import org.springframework.web.multipart.MultipartFile;

public interface OssService {
    /**
     * 上传文件到 OSS
     *
     * @param file      上传的文件
     * @param subDir    子目录，如 "questions/"，为 null 时使用默认前缀
     * @return 文件的完整访问 URL
     */
    String upload(MultipartFile file, String subDir);
}
