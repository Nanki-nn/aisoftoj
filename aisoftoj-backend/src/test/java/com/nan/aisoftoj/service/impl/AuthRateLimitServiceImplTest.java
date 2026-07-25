package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.auth.AuthEmailProperties;
import com.nan.aisoftoj.auth.EmailCodeCrypto;
import com.nan.aisoftoj.auth.EmailCodeScene;
import com.nan.aisoftoj.common.TooManyRequestsException;
import com.nan.aisoftoj.entity.AuthRateLimit;
import com.nan.aisoftoj.mapper.AuthRateLimitMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthRateLimitServiceImplTest {
    @Mock
    private AuthRateLimitMapper mapper;

    private AuthRateLimitServiceImpl service;

    @BeforeEach
    void setUp() {
        AuthEmailProperties properties = new AuthEmailProperties();
        properties.setCodeSecret("test-email-code-secret-with-more-than-32-bytes");
        properties.validate();
        service = new AuthRateLimitServiceImpl(mapper, new EmailCodeCrypto(properties));
    }

    @Test
    void rejectsRequestWhenAnyLockedWindowIsExhausted() {
        AuthRateLimit exhausted = new AuthRateLimit();
        exhausted.setCounter(100);
        exhausted.setWindowStart(LocalDateTime.now());
        exhausted.setExpiresAt(LocalDateTime.now().plusMinutes(10));
        when(mapper.selectForUpdate(anyString())).thenReturn(exhausted);

        assertThrows(TooManyRequestsException.class,
                () -> service.acquireEmailCodeLimits(
                        "user@example.com", EmailCodeScene.REGISTER, "127.0.0.1"));
    }

    @Test
    void resetsExpiredWindowBeforeIncrementing() {
        AuthRateLimit expired = new AuthRateLimit();
        expired.setCounter(100);
        expired.setWindowStart(LocalDateTime.now().minusHours(2));
        expired.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        when(mapper.selectForUpdate(anyString())).thenReturn(expired);

        service.acquirePasswordLoginLimits("user@example.com", "127.0.0.1");

        verify(mapper, atLeastOnce()).updateWindow(
                anyString(),
                org.mockito.ArgumentMatchers.eq(1),
                any(LocalDateTime.class),
                any(LocalDateTime.class),
                any(LocalDateTime.class));
    }
}
