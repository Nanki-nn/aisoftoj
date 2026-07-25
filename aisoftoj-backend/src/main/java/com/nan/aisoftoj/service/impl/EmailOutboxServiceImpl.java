package com.nan.aisoftoj.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.nan.aisoftoj.auth.AuthEmailProperties;
import com.nan.aisoftoj.auth.EmailCodeStatus;
import com.nan.aisoftoj.auth.EmailOutboxStatus;
import com.nan.aisoftoj.entity.AuthEmailOutbox;
import com.nan.aisoftoj.mapper.AuthEmailCodeMapper;
import com.nan.aisoftoj.mapper.AuthEmailOutboxMapper;
import com.nan.aisoftoj.mapper.AuthRateLimitMapper;
import com.nan.aisoftoj.service.EmailOutboxService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class EmailOutboxServiceImpl implements EmailOutboxService {
    private final AuthEmailOutboxMapper outboxMapper;
    private final AuthEmailCodeMapper codeMapper;
    private final AuthRateLimitMapper rateLimitMapper;
    private final AuthEmailProperties properties;

    public EmailOutboxServiceImpl(
            AuthEmailOutboxMapper outboxMapper,
            AuthEmailCodeMapper codeMapper,
            AuthRateLimitMapper rateLimitMapper,
            AuthEmailProperties properties) {
        this.outboxMapper = outboxMapper;
        this.codeMapper = codeMapper;
        this.rateLimitMapper = rateLimitMapper;
        this.properties = properties;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void releaseStaleClaims() {
        LocalDateTime now = LocalDateTime.now();
        outboxMapper.releaseStaleClaims(now.minusMinutes(properties.getStaleLockMinutes()), now);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AuthEmailOutbox claimNext() {
        LocalDateTime now = LocalDateTime.now();
        for (int attempt = 0; attempt < 3; attempt++) {
            Long id = outboxMapper.selectNextPendingId(now);
            if (id == null) {
                return null;
            }
            if (outboxMapper.claimPending(id, now) == 1) {
                return outboxMapper.selectById(id);
            }
        }
        return null;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void markSent(AuthEmailOutbox outbox) {
        codeMapper.supersedeOtherActive(outbox.getEmail(), outbox.getScene(), outbox.getCodeId());
        if (codeMapper.activate(outbox.getCodeId(), properties.getCodeExpiresMinutes()) != 1) {
            throw new IllegalStateException("验证码激活状态不正确");
        }
        int updated = outboxMapper.update(null, Wrappers.lambdaUpdate(AuthEmailOutbox.class)
                .eq(AuthEmailOutbox::getId, outbox.getId())
                .eq(AuthEmailOutbox::getStatus, EmailOutboxStatus.SENDING)
                .set(AuthEmailOutbox::getStatus, EmailOutboxStatus.SENT)
                .set(AuthEmailOutbox::getPayloadCiphertext, null)
                .set(AuthEmailOutbox::getPayloadIv, null)
                .set(AuthEmailOutbox::getLockedAt, null)
                .set(AuthEmailOutbox::getLastError, null)
                .set(AuthEmailOutbox::getUpdateTime, LocalDateTime.now()));
        if (updated != 1) {
            throw new IllegalStateException("邮件发件箱完成状态不正确");
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void markDeliveryFailure(AuthEmailOutbox outbox, String errorCategory) {
        boolean terminal = outbox.getAttemptCount() >= properties.getMaxDeliveryAttempts()
                || isQueueExpired(outbox, LocalDateTime.now());
        if (terminal) {
            markTerminalFailure(outbox, errorCategory);
            return;
        }

        long backoffSeconds = outbox.getAttemptCount() <= 1 ? 30L : 120L;
        outboxMapper.update(null, Wrappers.lambdaUpdate(AuthEmailOutbox.class)
                .eq(AuthEmailOutbox::getId, outbox.getId())
                .eq(AuthEmailOutbox::getStatus, EmailOutboxStatus.SENDING)
                .set(AuthEmailOutbox::getStatus, EmailOutboxStatus.PENDING)
                .set(AuthEmailOutbox::getNextAttemptAt, LocalDateTime.now().plusSeconds(backoffSeconds))
                .set(AuthEmailOutbox::getLockedAt, null)
                .set(AuthEmailOutbox::getLastError, sanitizeError(errorCategory))
                .set(AuthEmailOutbox::getUpdateTime, LocalDateTime.now()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void markExpired(AuthEmailOutbox outbox) {
        markTerminalFailure(outbox, "queue-expired");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void cleanupExpiredRecords() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(7);
        outboxMapper.deleteTerminalBefore(cutoff);
        codeMapper.deleteCreatedBefore(cutoff);
        rateLimitMapper.deleteExpiredBefore(cutoff);
    }

    private void markTerminalFailure(AuthEmailOutbox outbox, String errorCategory) {
        outboxMapper.update(null, Wrappers.lambdaUpdate(AuthEmailOutbox.class)
                .eq(AuthEmailOutbox::getId, outbox.getId())
                .in(AuthEmailOutbox::getStatus, EmailOutboxStatus.SENDING, EmailOutboxStatus.PENDING)
                .set(AuthEmailOutbox::getStatus, EmailOutboxStatus.FAILED)
                .set(AuthEmailOutbox::getPayloadCiphertext, null)
                .set(AuthEmailOutbox::getPayloadIv, null)
                .set(AuthEmailOutbox::getLockedAt, null)
                .set(AuthEmailOutbox::getLastError, sanitizeError(errorCategory))
                .set(AuthEmailOutbox::getUpdateTime, LocalDateTime.now()));
        codeMapper.failPending(outbox.getCodeId());
    }

    private boolean isQueueExpired(AuthEmailOutbox outbox, LocalDateTime now) {
        return outbox.getCreateTime() == null
                || !outbox.getCreateTime().plusMinutes(properties.getMaxQueueMinutes()).isAfter(now);
    }

    private String sanitizeError(String errorCategory) {
        if (errorCategory == null || errorCategory.trim().isEmpty()) {
            return "delivery-failed";
        }
        String value = errorCategory.replaceAll("[^a-zA-Z0-9._-]", "-");
        return value.length() > 64 ? value.substring(0, 64) : value;
    }
}
