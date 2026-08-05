package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.auth.EmailCodeCrypto;
import com.nan.aisoftoj.auth.EmailCodeScene;
import com.nan.aisoftoj.auth.EmailCodeStatus;
import com.nan.aisoftoj.auth.EmailNormalizer;
import com.nan.aisoftoj.auth.EmailOutboxStatus;
import com.nan.aisoftoj.auth.AuthEmailProperties;
import com.nan.aisoftoj.common.InvalidEmailCodeException;
import com.nan.aisoftoj.common.UserRole;
import com.nan.aisoftoj.entity.AuthEmailCode;
import com.nan.aisoftoj.entity.AuthEmailOutbox;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.mapper.AuthEmailCodeMapper;
import com.nan.aisoftoj.mapper.AuthEmailOutboxMapper;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.service.AuthEmailSender;
import com.nan.aisoftoj.service.AuthRateLimitService;
import com.nan.aisoftoj.service.EmailCodeService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class EmailCodeServiceImpl implements EmailCodeService {
    private final AuthEmailCodeMapper codeMapper;
    private final AuthEmailOutboxMapper outboxMapper;
    private final UserMapper userMapper;
    private final AuthRateLimitService rateLimitService;
    private final AuthEmailSender emailSender;
    private final EmailCodeCrypto crypto;
    private final AuthEmailProperties properties;

    public EmailCodeServiceImpl(
            AuthEmailCodeMapper codeMapper,
            AuthEmailOutboxMapper outboxMapper,
            UserMapper userMapper,
            AuthRateLimitService rateLimitService,
            AuthEmailSender emailSender,
            EmailCodeCrypto crypto,
            AuthEmailProperties properties) {
        this.codeMapper = codeMapper;
        this.outboxMapper = outboxMapper;
        this.userMapper = userMapper;
        this.rateLimitService = rateLimitService;
        this.emailSender = emailSender;
        this.crypto = crypto;
        this.properties = properties;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void requestCode(String email, EmailCodeScene scene, String requestIp) {
        String normalizedEmail = EmailNormalizer.normalize(email);
        emailSender.ensureConfigured();

        User existing = userMapper.selectAnyByNormalizedEmail(normalizedEmail);
        if (scene == EmailCodeScene.REGISTER && existing != null) {
            throw new IllegalArgumentException("该邮箱已被注册");
        }

        rateLimitService.acquireEmailCodeLimits(normalizedEmail, scene, normalizeIp(requestIp));
        boolean deliverable = scene == EmailCodeScene.REGISTER || isActiveVerifiedUser(existing);

        persistCode(normalizedEmail, scene, requestIp, deliverable);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void requestBindingCode(String email, String requestIp, Integer currentUserId) {
        String normalizedEmail = EmailNormalizer.normalize(email);
        emailSender.ensureConfigured();
        User existing = userMapper.selectAnyByNormalizedEmail(normalizedEmail);
        rateLimitService.acquireEmailBindingCodeLimits(
                normalizedEmail, normalizeIp(requestIp), currentUserId);
        boolean deliverable = existing == null || isActiveVerifiedRegularUser(existing);
        persistCode(normalizedEmail, EmailCodeScene.BIND_EMAIL, requestIp, deliverable);
    }

    private void persistCode(
            String normalizedEmail,
            EmailCodeScene scene,
            String requestIp,
            boolean deliverable) {
        String code = crypto.generateCode();
        String salt = crypto.generateSalt();
        AuthEmailCode record = new AuthEmailCode();
        record.setEmail(normalizedEmail);
        record.setScene(scene.name());
        record.setCodeSalt(salt);
        record.setCodeHash(crypto.hashCode(normalizedEmail, scene, salt, code));
        record.setStatus(deliverable ? EmailCodeStatus.PENDING : EmailCodeStatus.SUPPRESSED);
        record.setFailedAttempts(0);
        record.setRequestIp(normalizeIp(requestIp));
        record.setCreateTime(LocalDateTime.now());
        codeMapper.insert(record);

        if (!deliverable) {
            return;
        }

        EmailCodeCrypto.EncryptedCode encryptedCode = crypto.encrypt(code);
        AuthEmailOutbox outbox = new AuthEmailOutbox();
        outbox.setCodeId(record.getId());
        outbox.setEmail(normalizedEmail);
        outbox.setScene(scene.name());
        outbox.setPayloadCiphertext(encryptedCode.getCiphertext());
        outbox.setPayloadIv(encryptedCode.getIv());
        outbox.setStatus(EmailOutboxStatus.PENDING);
        outbox.setAttemptCount(0);
        outbox.setNextAttemptAt(LocalDateTime.now());
        outbox.setCreateTime(LocalDateTime.now());
        outbox.setUpdateTime(LocalDateTime.now());
        outboxMapper.insert(outbox);
    }

    @Override
    @Transactional(noRollbackFor = InvalidEmailCodeException.class)
    public void consumeCode(String normalizedEmail, EmailCodeScene scene, String code) {
        LocalDateTime now = LocalDateTime.now();
        int maxAttempts = properties.getCodeMaxAttempts();
        AuthEmailCode record = codeMapper.selectLatestActiveForUpdate(
                normalizedEmail, scene.name(), maxAttempts, now);
        if (record == null) {
            throw new InvalidEmailCodeException();
        }
        if (!crypto.matches(record.getCodeHash(), normalizedEmail, scene, record.getCodeSalt(), code)) {
            codeMapper.recordFailure(record.getId(), maxAttempts, now);
            throw new InvalidEmailCodeException();
        }
        if (codeMapper.consumeActive(record.getId(), maxAttempts, now) != 1) {
            throw new InvalidEmailCodeException();
        }
    }

    private boolean isActiveVerifiedUser(User user) {
        return user != null
                && !Boolean.TRUE.equals(user.getIsDeleted())
                && Boolean.TRUE.equals(user.getIsEnabled())
                && user.getEmailVerifiedAt() != null;
    }

    private boolean isActiveVerifiedRegularUser(User user) {
        return isActiveVerifiedUser(user)
                && UserRole.USER.name().equals(user.getRole());
    }

    private String normalizeIp(String requestIp) {
        String value = requestIp == null ? "unknown" : requestIp.trim();
        if (value.isEmpty()) {
            return "unknown";
        }
        return value.length() > 64 ? value.substring(0, 64) : value;
    }
}
