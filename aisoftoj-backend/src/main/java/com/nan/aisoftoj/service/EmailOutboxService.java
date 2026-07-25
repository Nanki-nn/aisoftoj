package com.nan.aisoftoj.service;

import com.nan.aisoftoj.entity.AuthEmailOutbox;

public interface EmailOutboxService {
    void releaseStaleClaims();

    AuthEmailOutbox claimNext();

    void markSent(AuthEmailOutbox outbox);

    void markDeliveryFailure(AuthEmailOutbox outbox, String errorCategory);

    void markExpired(AuthEmailOutbox outbox);

    void cleanupExpiredRecords();
}
