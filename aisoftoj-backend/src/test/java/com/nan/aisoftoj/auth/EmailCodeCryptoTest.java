package com.nan.aisoftoj.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EmailCodeCryptoTest {
    private EmailCodeCrypto crypto;

    @BeforeEach
    void setUp() {
        AuthEmailProperties properties = new AuthEmailProperties();
        properties.setCodeSecret("test-email-code-secret-with-more-than-32-bytes");
        properties.validate();
        crypto = new EmailCodeCrypto(properties);
    }

    @Test
    void hashesCodesWithSceneAndSaltSeparation() {
        String salt = crypto.generateSalt();
        String hash = crypto.hashCode("user@example.com", EmailCodeScene.REGISTER, salt, "123456");

        assertTrue(crypto.matches(hash, "user@example.com", EmailCodeScene.REGISTER, salt, "123456"));
        assertFalse(crypto.matches(hash, "user@example.com", EmailCodeScene.LOGIN, salt, "123456"));
        assertFalse(crypto.matches(hash, "user@example.com", EmailCodeScene.REGISTER, salt, "654321"));
    }

    @Test
    void encryptsOutboxCodeWithFreshIv() {
        EmailCodeCrypto.EncryptedCode first = crypto.encrypt("123456");
        EmailCodeCrypto.EncryptedCode second = crypto.encrypt("123456");

        assertEquals("123456", crypto.decrypt(first.getCiphertext(), first.getIv()));
        assertEquals("123456", crypto.decrypt(second.getCiphertext(), second.getIv()));
        assertNotEquals(first.getIv(), second.getIv());
        assertNotEquals(first.getCiphertext(), second.getCiphertext());
    }

    @Test
    void rateLimitKeysDoNotExposeIdentity() {
        String key = crypto.stableLimitKey("login", "user@example.com");
        assertEquals(64, key.length());
        assertFalse(key.contains("user"));
    }
}
