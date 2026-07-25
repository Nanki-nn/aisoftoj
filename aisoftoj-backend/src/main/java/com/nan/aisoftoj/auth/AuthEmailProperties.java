package com.nan.aisoftoj.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;

@Component
@ConfigurationProperties(prefix = "auth.email")
public class AuthEmailProperties {
    private String codeSecret;
    private String from;
    private String fromName = "知构软考";
    private int codeExpiresMinutes = 10;
    private int codeMaxAttempts = 5;
    private int maxQueueMinutes = 10;
    private int maxDeliveryAttempts = 3;
    private int workerBatchSize = 20;
    private int staleLockMinutes = 5;

    @PostConstruct
    public void validate() {
        int secretBytes = codeSecret == null ? 0 : codeSecret.getBytes(StandardCharsets.UTF_8).length;
        if (secretBytes < 32) {
            throw new IllegalStateException("AUTH_EMAIL_CODE_SECRET 必须至少包含 32 字节的高熵随机内容");
        }
    }

    public String getCodeSecret() {
        return codeSecret;
    }

    public void setCodeSecret(String codeSecret) {
        this.codeSecret = codeSecret;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public String getFromName() {
        return fromName;
    }

    public void setFromName(String fromName) {
        this.fromName = fromName;
    }

    public int getCodeExpiresMinutes() {
        return codeExpiresMinutes;
    }

    public void setCodeExpiresMinutes(int codeExpiresMinutes) {
        this.codeExpiresMinutes = codeExpiresMinutes;
    }

    public int getCodeMaxAttempts() {
        return codeMaxAttempts;
    }

    public void setCodeMaxAttempts(int codeMaxAttempts) {
        this.codeMaxAttempts = codeMaxAttempts;
    }

    public int getMaxQueueMinutes() {
        return maxQueueMinutes;
    }

    public void setMaxQueueMinutes(int maxQueueMinutes) {
        this.maxQueueMinutes = maxQueueMinutes;
    }

    public int getMaxDeliveryAttempts() {
        return maxDeliveryAttempts;
    }

    public void setMaxDeliveryAttempts(int maxDeliveryAttempts) {
        this.maxDeliveryAttempts = maxDeliveryAttempts;
    }

    public int getWorkerBatchSize() {
        return workerBatchSize;
    }

    public void setWorkerBatchSize(int workerBatchSize) {
        this.workerBatchSize = workerBatchSize;
    }

    public int getStaleLockMinutes() {
        return staleLockMinutes;
    }

    public void setStaleLockMinutes(int staleLockMinutes) {
        this.staleLockMinutes = staleLockMinutes;
    }
}
