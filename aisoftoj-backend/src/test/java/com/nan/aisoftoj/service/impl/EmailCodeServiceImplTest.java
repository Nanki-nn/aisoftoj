package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.auth.AuthEmailProperties;
import com.nan.aisoftoj.auth.EmailCodeCrypto;
import com.nan.aisoftoj.auth.EmailCodeScene;
import com.nan.aisoftoj.auth.EmailCodeStatus;
import com.nan.aisoftoj.common.InvalidEmailCodeException;
import com.nan.aisoftoj.entity.AuthEmailCode;
import com.nan.aisoftoj.entity.AuthEmailOutbox;
import com.nan.aisoftoj.mapper.AuthEmailCodeMapper;
import com.nan.aisoftoj.mapper.AuthEmailOutboxMapper;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.service.AuthEmailSender;
import com.nan.aisoftoj.service.AuthRateLimitService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailCodeServiceImplTest {
    @Mock
    private AuthEmailCodeMapper codeMapper;
    @Mock
    private AuthEmailOutboxMapper outboxMapper;
    @Mock
    private UserMapper userMapper;
    @Mock
    private AuthRateLimitService rateLimitService;
    @Mock
    private AuthEmailSender emailSender;

    private AuthEmailProperties properties;
    private EmailCodeCrypto crypto;
    private EmailCodeServiceImpl service;

    @BeforeEach
    void setUp() {
        properties = new AuthEmailProperties();
        properties.setCodeSecret("test-email-code-secret-with-more-than-32-bytes");
        properties.validate();
        crypto = new EmailCodeCrypto(properties);
        service = new EmailCodeServiceImpl(
                codeMapper,
                outboxMapper,
                userMapper,
                rateLimitService,
                emailSender,
                crypto,
                properties);
    }

    @Test
    void registrationRequestStoresHashAndEncryptedOutboxPayload() {
        doAnswer(invocation -> {
            AuthEmailCode record = invocation.getArgument(0);
            record.setId(11L);
            return 1;
        }).when(codeMapper).insert(any(AuthEmailCode.class));

        service.requestCode(" USER@example.com ", EmailCodeScene.REGISTER, "127.0.0.1");

        ArgumentCaptor<AuthEmailCode> codeCaptor = ArgumentCaptor.forClass(AuthEmailCode.class);
        verify(codeMapper).insert(codeCaptor.capture());
        AuthEmailCode storedCode = codeCaptor.getValue();
        assertEquals("user@example.com", storedCode.getEmail());
        assertEquals(EmailCodeStatus.PENDING, storedCode.getStatus());
        assertNotNull(storedCode.getCodeHash());

        ArgumentCaptor<AuthEmailOutbox> outboxCaptor = ArgumentCaptor.forClass(AuthEmailOutbox.class);
        verify(outboxMapper).insert(outboxCaptor.capture());
        AuthEmailOutbox outbox = outboxCaptor.getValue();
        String plaintextCode = crypto.decrypt(outbox.getPayloadCiphertext(), outbox.getPayloadIv());
        org.junit.jupiter.api.Assertions.assertTrue(crypto.matches(
                storedCode.getCodeHash(),
                storedCode.getEmail(),
                EmailCodeScene.REGISTER,
                storedCode.getCodeSalt(),
                plaintextCode));
        verify(rateLimitService).acquireEmailCodeLimits(
                "user@example.com", EmailCodeScene.REGISTER, "127.0.0.1");
    }

    @Test
    void missingLoginAccountCreatesSuppressedRecordWithoutOutbox() {
        service.requestCode("missing@example.com", EmailCodeScene.LOGIN, "127.0.0.1");

        ArgumentCaptor<AuthEmailCode> codeCaptor = ArgumentCaptor.forClass(AuthEmailCode.class);
        verify(codeMapper).insert(codeCaptor.capture());
        assertEquals(EmailCodeStatus.SUPPRESSED, codeCaptor.getValue().getStatus());
        verify(outboxMapper, never()).insert(any(AuthEmailOutbox.class));
    }

    @Test
    void wrongCodeRecordsFailureAndCannotConsume() {
        String salt = crypto.generateSalt();
        AuthEmailCode record = activeCode(
                crypto.hashCode("user@example.com", EmailCodeScene.LOGIN, salt, "123456"), salt);
        when(codeMapper.selectLatestActiveForUpdate(anyString(), anyString(), anyInt(), any(LocalDateTime.class)))
                .thenReturn(record);

        assertThrows(InvalidEmailCodeException.class,
                () -> service.consumeCode("user@example.com", EmailCodeScene.LOGIN, "654321"));

        verify(codeMapper).recordFailure(
                org.mockito.ArgumentMatchers.eq(7L),
                org.mockito.ArgumentMatchers.eq(5),
                any(LocalDateTime.class));
        verify(codeMapper, never()).consumeActive(any(), anyInt(), any(LocalDateTime.class));
    }

    @Test
    void correctCodeIsConsumedAtomically() {
        String salt = crypto.generateSalt();
        AuthEmailCode record = activeCode(
                crypto.hashCode("user@example.com", EmailCodeScene.LOGIN, salt, "123456"), salt);
        when(codeMapper.selectLatestActiveForUpdate(anyString(), anyString(), anyInt(), any(LocalDateTime.class)))
                .thenReturn(record);
        when(codeMapper.consumeActive(any(), anyInt(), any(LocalDateTime.class))).thenReturn(1);

        service.consumeCode("user@example.com", EmailCodeScene.LOGIN, "123456");

        verify(codeMapper).consumeActive(
                org.mockito.ArgumentMatchers.eq(7L),
                org.mockito.ArgumentMatchers.eq(5),
                any(LocalDateTime.class));
    }

    private AuthEmailCode activeCode(String hash, String salt) {
        AuthEmailCode record = new AuthEmailCode();
        record.setId(7L);
        record.setCodeHash(hash);
        record.setCodeSalt(salt);
        record.setStatus(EmailCodeStatus.ACTIVE);
        return record;
    }
}
