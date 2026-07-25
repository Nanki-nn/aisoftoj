package com.nan.aisoftoj.crypto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.spec.MGF1ParameterSpec;
import java.util.Base64;

@Service
public class QuestionContentEncryptionService {

    private static final int AES_KEY_BITS = 256;
    private static final int GCM_IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;

    private static final OAEPParameterSpec OAEP_SHA_256 = new OAEPParameterSpec(
            "SHA-256",
            "MGF1",
            MGF1ParameterSpec.SHA256,
            PSource.PSpecified.DEFAULT);

    private final ObjectMapper objectMapper;
    private final ContentCryptoProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    public QuestionContentEncryptionService(
            ObjectMapper objectMapper,
            ContentCryptoProperties properties) {
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    @PostConstruct
    public void verifyCryptoRuntime() {
        try {
            if (Cipher.getMaxAllowedKeyLength("AES") < AES_KEY_BITS) {
                throw new IllegalStateException("当前 JDK 未启用 AES-256 unlimited cryptography");
            }
            Cipher.getInstance("AES/GCM/NoPadding");
            Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
        } catch (IllegalStateException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("当前 JDK 不支持题目内容加密协议", ex);
        }
    }

    public EncryptedContentResponse encrypt(Object body, PublicKey publicKey) {
        if (publicKey == null) {
            throw new ContentEncryptionException("题目数据加密公钥缺失");
        }

        try {
            byte[] plaintext = serializeBounded(body);

            KeyGenerator keyGenerator = KeyGenerator.getInstance("AES");
            keyGenerator.init(AES_KEY_BITS, secureRandom);
            SecretKey aesKey = keyGenerator.generateKey();

            byte[] iv = new byte[GCM_IV_BYTES];
            secureRandom.nextBytes(iv);

            Cipher aesCipher = Cipher.getInstance("AES/GCM/NoPadding");
            aesCipher.init(Cipher.ENCRYPT_MODE, aesKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] ciphertext = aesCipher.doFinal(plaintext);

            Cipher rsaCipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
            rsaCipher.init(Cipher.ENCRYPT_MODE, publicKey, OAEP_SHA_256);
            byte[] encryptedKey = rsaCipher.doFinal(aesKey.getEncoded());

            Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
            return new EncryptedContentResponse(
                    1,
                    ContentCryptoHeaders.ALGORITHM,
                    encoder.encodeToString(encryptedKey),
                    encoder.encodeToString(iv),
                    encoder.encodeToString(ciphertext));
        } catch (ContentCryptoPayloadTooLargeException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ContentEncryptionException("题目数据加密失败", ex);
        }
    }

    private byte[] serializeBounded(Object body) {
        BoundedOutputStream output = new BoundedOutputStream(properties.getMaxPlaintextBytes());
        try {
            objectMapper.writeValue(output, body);
            return output.toByteArray();
        } catch (Exception ex) {
            if (containsSizeLimit(ex)) {
                throw new ContentCryptoPayloadTooLargeException("题目数据响应过大", ex);
            }
            throw new ContentEncryptionException("题目数据序列化失败", ex);
        }
    }

    private boolean containsSizeLimit(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof SizeLimitExceededIOException) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private static class BoundedOutputStream extends OutputStream {
        private final int maxBytes;
        private final ByteArrayOutputStream delegate;

        private BoundedOutputStream(int maxBytes) {
            if (maxBytes < 1) {
                throw new IllegalArgumentException("maxPlaintextBytes 必须大于 0");
            }
            this.maxBytes = maxBytes;
            this.delegate = new ByteArrayOutputStream(Math.min(maxBytes, 16 * 1024));
        }

        @Override
        public void write(int value) throws IOException {
            ensureCapacity(1);
            delegate.write(value);
        }

        @Override
        public void write(byte[] buffer, int offset, int length) throws IOException {
            ensureCapacity(length);
            delegate.write(buffer, offset, length);
        }

        private void ensureCapacity(int additionalBytes) throws SizeLimitExceededIOException {
            if (additionalBytes < 0 || delegate.size() > maxBytes - additionalBytes) {
                throw new SizeLimitExceededIOException();
            }
        }

        private byte[] toByteArray() {
            return delegate.toByteArray();
        }
    }

    private static class SizeLimitExceededIOException extends IOException {
        private static final long serialVersionUID = 1L;
    }
}
