package com.nan.aisoftoj.auth;

import com.nan.aisoftoj.entity.AuthEmailOutbox;
import com.nan.aisoftoj.service.AuthEmailSender;
import com.nan.aisoftoj.service.EmailOutboxService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class EmailOutboxWorker {
    private static final Logger log = LoggerFactory.getLogger(EmailOutboxWorker.class);

    private final EmailOutboxService outboxService;
    private final AuthEmailSender emailSender;
    private final EmailCodeCrypto crypto;
    private final AuthEmailProperties properties;

    public EmailOutboxWorker(
            EmailOutboxService outboxService,
            AuthEmailSender emailSender,
            EmailCodeCrypto crypto,
            AuthEmailProperties properties) {
        this.outboxService = outboxService;
        this.emailSender = emailSender;
        this.crypto = crypto;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "${auth.email.worker-delay-ms:1000}")
    public void deliverPendingEmails() {
        outboxService.releaseStaleClaims();
        for (int index = 0; index < properties.getWorkerBatchSize(); index++) {
            AuthEmailOutbox outbox = outboxService.claimNext();
            if (outbox == null) {
                return;
            }
            if (isExpired(outbox)) {
                outboxService.markExpired(outbox);
                continue;
            }
            deliver(outbox);
        }
    }

    @Scheduled(cron = "${auth.email.cleanup-cron:0 15 3 * * *}")
    public void cleanupExpiredRecords() {
        outboxService.cleanupExpiredRecords();
    }

    private void deliver(AuthEmailOutbox outbox) {
        try {
            String code = crypto.decrypt(outbox.getPayloadCiphertext(), outbox.getPayloadIv());
            emailSender.sendCode(outbox.getEmail(), EmailCodeScene.from(outbox.getScene()), code);
            outboxService.markSent(outbox);
        } catch (RuntimeException ex) {
            log.warn("Authentication email delivery failed for outbox {} ({})",
                    outbox.getId(), ex.getClass().getSimpleName());
            outboxService.markDeliveryFailure(outbox, ex.getClass().getSimpleName());
        }
    }

    private boolean isExpired(AuthEmailOutbox outbox) {
        return outbox.getCreateTime() == null
                || !outbox.getCreateTime().plusMinutes(properties.getMaxQueueMinutes()).isAfter(LocalDateTime.now());
    }
}
