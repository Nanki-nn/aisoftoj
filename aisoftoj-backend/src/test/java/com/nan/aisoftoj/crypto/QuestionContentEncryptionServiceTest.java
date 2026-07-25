package com.nan.aisoftoj.crypto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nan.aisoftoj.dto.ResultDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.spec.MGF1ParameterSpec;
import java.util.Base64;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class QuestionContentEncryptionServiceTest {

    private static final OAEPParameterSpec OAEP_SHA_256 = new OAEPParameterSpec(
            "SHA-256",
            "MGF1",
            MGF1ParameterSpec.SHA256,
            PSource.PSpecified.DEFAULT);

    private ObjectMapper objectMapper;
    private ContentCryptoProperties properties;
    private QuestionContentEncryptionService service;
    private KeyPair keyPair;

    @BeforeEach
    void setUp() throws Exception {
        objectMapper = new ObjectMapper();
        properties = new ContentCryptoProperties();
        service = new QuestionContentEncryptionService(objectMapper, properties);
        service.verifyCryptoRuntime();
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        keyPair = generator.generateKeyPair();
    }

    @Test
    void encryptsAndDecryptsResultDto() throws Exception {
        ResultDTO<?> original = ResultDTO.success(Collections.singletonMap("answer", "A"));
        EncryptedContentResponse encrypted = service.encrypt(original, keyPair.getPublic());

        byte[] plaintext = decrypt(encrypted);
        JsonNode expected = objectMapper.readTree(objectMapper.writeValueAsBytes(original));
        JsonNode actual = objectMapper.readTree(plaintext);

        assertEquals(1, encrypted.getVersion());
        assertEquals(ContentCryptoHeaders.ALGORITHM, encrypted.getAlgorithm());
        assertEquals(expected, actual);
    }

    @Test
    void usesFreshKeyAndIvForEveryResponse() {
        ResultDTO<?> original = ResultDTO.success(Collections.singletonMap("question", "same"));
        EncryptedContentResponse first = service.encrypt(original, keyPair.getPublic());
        EncryptedContentResponse second = service.encrypt(original, keyPair.getPublic());

        assertNotEquals(first.getEncryptedKey(), second.getEncryptedKey());
        assertNotEquals(first.getIv(), second.getIv());
        assertNotEquals(first.getCiphertext(), second.getCiphertext());
    }

    @Test
    void enforcesSerializedPlaintextBoundary() throws Exception {
        String body = "边界测试";
        int serializedBytes = objectMapper.writeValueAsBytes(body).length;
        properties.setMaxPlaintextBytes(serializedBytes);
        service.encrypt(body, keyPair.getPublic());

        properties.setMaxPlaintextBytes(serializedBytes - 1);
        assertThrows(
                ContentCryptoPayloadTooLargeException.class,
                () -> service.encrypt(body, keyPair.getPublic()));
    }

    @Test
    void tamperedCiphertextFailsAuthentication() throws Exception {
        EncryptedContentResponse encrypted = service.encrypt(
                ResultDTO.success("secret"),
                keyPair.getPublic());
        byte[] ciphertext = decode(encrypted.getCiphertext());
        ciphertext[ciphertext.length - 1] ^= 1;
        EncryptedContentResponse tampered = new EncryptedContentResponse(
                encrypted.getVersion(),
                encrypted.getAlgorithm(),
                encrypted.getEncryptedKey(),
                encrypted.getIv(),
                encode(ciphertext));

        assertThrows(Exception.class, () -> decrypt(tampered));
    }

    private byte[] decrypt(EncryptedContentResponse encrypted) throws Exception {
        Cipher rsa = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
        rsa.init(Cipher.DECRYPT_MODE, keyPair.getPrivate(), OAEP_SHA_256);
        byte[] aesKey = rsa.doFinal(decode(encrypted.getEncryptedKey()));

        Cipher aes = Cipher.getInstance("AES/GCM/NoPadding");
        aes.init(
                Cipher.DECRYPT_MODE,
                new javax.crypto.spec.SecretKeySpec(aesKey, "AES"),
                new GCMParameterSpec(128, decode(encrypted.getIv())));
        return aes.doFinal(decode(encrypted.getCiphertext()));
    }

    private byte[] decode(String value) {
        return Base64.getUrlDecoder().decode(value);
    }

    private String encode(byte[] value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }
}
