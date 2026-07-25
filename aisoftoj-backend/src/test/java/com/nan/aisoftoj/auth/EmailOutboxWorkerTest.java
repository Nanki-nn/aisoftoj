package com.nan.aisoftoj.auth;

import com.nan.aisoftoj.entity.AuthEmailOutbox;
import com.nan.aisoftoj.service.AuthEmailSender;
import com.nan.aisoftoj.service.EmailOutboxService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailOutboxWorkerTest {
    @Mock
    private EmailOutboxService outboxService;
    @Mock
    private AuthEmailSender emailSender;

    private AuthEmailProperties properties;
    private EmailCodeCrypto crypto;
    private EmailOutboxWorker worker;

    @BeforeEach
    void setUp() {
        properties = new AuthEmailProperties();
        properties.setCodeSecret("test-email-code-secret-with-more-than-32-bytes");
        properties.setWorkerBatchSize(2);
        properties.validate();
        crypto = new EmailCodeCrypto(properties);
        worker = new EmailOutboxWorker(outboxService, emailSender, crypto, properties);
    }

    @Test
    void sendsEncryptedPayloadAndMarksOutboxSent() {
        EmailCodeCrypto.EncryptedCode encrypted = crypto.encrypt("123456");
        AuthEmailOutbox outbox = outbox(encrypted);
        when(outboxService.claimNext()).thenReturn(outbox, null);

        worker.deliverPendingEmails();

        verify(emailSender).sendCode("user@example.com", EmailCodeScene.REGISTER, "123456");
        verify(outboxService).markSent(outbox);
    }

    @Test
    void expiredQueueEntryIsNeverSent() {
        EmailCodeCrypto.EncryptedCode encrypted = crypto.encrypt("123456");
        AuthEmailOutbox outbox = outbox(encrypted);
        outbox.setCreateTime(LocalDateTime.now().minusMinutes(11));
        when(outboxService.claimNext()).thenReturn(outbox, null);

        worker.deliverPendingEmails();

        verify(outboxService).markExpired(outbox);
        org.mockito.Mockito.verifyNoInteractions(emailSender);
    }

    private AuthEmailOutbox outbox(EmailCodeCrypto.EncryptedCode encrypted) {
        AuthEmailOutbox outbox = new AuthEmailOutbox();
        outbox.setId(3L);
        outbox.setCodeId(4L);
        outbox.setEmail("user@example.com");
        outbox.setScene(EmailCodeScene.REGISTER.name());
        outbox.setPayloadCiphertext(encrypted.getCiphertext());
        outbox.setPayloadIv(encrypted.getIv());
        outbox.setCreateTime(LocalDateTime.now());
        return outbox;
    }
}
