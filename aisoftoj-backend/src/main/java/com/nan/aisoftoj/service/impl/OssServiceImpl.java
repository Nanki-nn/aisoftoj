package com.nan.aisoftoj.service.impl;

import cn.hutool.core.util.StrUtil;
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.model.ObjectMetadata;
import com.nan.aisoftoj.config.OssProperties;
import com.nan.aisoftoj.service.OssService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
public class OssServiceImpl implements OssService {

    @Autowired
    private OssProperties ossProperties;

    @Override
    public String upload(MultipartFile file, String subDir) {
        validateConfig();

        String originalFilename = file.getOriginalFilename();
        String ext = "";
        if (StrUtil.isNotBlank(originalFilename) && originalFilename.contains(".")) {
            ext = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
        }

        // 按日期分目录，避免单目录文件过多
        String datePath = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
        String dir = StrUtil.blankToDefault(ossProperties.getDirPrefix(), "aisoftoj/")
                + StrUtil.blankToDefault(subDir, "")
                + datePath + "/";
        String objectKey = dir + UUID.randomUUID().toString().replace("-", "") + ext;

        OSS ossClient = new OSSClientBuilder().build(
                ossProperties.getEndpoint(),
                ossProperties.getAccessKeyId(),
                ossProperties.getAccessKeySecret()
        );

        try {
            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentType(file.getContentType());
            metadata.setContentLength(file.getSize());
            ossClient.putObject(ossProperties.getBucketName(), objectKey, file.getInputStream(), metadata);
        } catch (IOException e) {
            throw new RuntimeException("文件上传失败: " + e.getMessage(), e);
        } finally {
            ossClient.shutdown();
        }

        String baseUrl = ossProperties.getBaseUrl();
        if (StrUtil.isBlank(baseUrl)) {
            baseUrl = "https://" + ossProperties.getBucketName() + "." + ossProperties.getEndpoint();
        }
        return baseUrl.replaceAll("/$", "") + "/" + objectKey;
    }

    private void validateConfig() {
        if (StrUtil.isBlank(ossProperties.getEndpoint())
                || StrUtil.isBlank(ossProperties.getAccessKeyId())
                || StrUtil.isBlank(ossProperties.getAccessKeySecret())
                || StrUtil.isBlank(ossProperties.getBucketName())) {
            throw new IllegalStateException("OSS 配置不完整，请检查 OSS_ENDPOINT / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET_NAME");
        }
    }
}
