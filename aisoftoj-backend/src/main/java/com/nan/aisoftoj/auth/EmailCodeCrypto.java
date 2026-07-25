package com.nan.aisoftoj.auth;

import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Component
public class EmailCodeCrypto {
    private static final int GCM_TAG_BITS = 128;
    private static final int GCM_IV_BYTES = 12;
    private static final int SALT_BYTES = 16;

    private final SecureRandom secureRandom = new SecureRandom();
    private final byte[] hashKey;
    private final byte[] encryptionKey;

    public EmailCodeCrypto(AuthEmailProperties properties) {
        byte[] masterKey = properties.getCodeSecret().getBytes(StandardCharsets.UTF_8);
        this.hashKey = deriveKey(masterKey, "email-code-hmac");
        this.encryptionKey = deriveKey(masterKey, "email-code-encryption");
    }

    public String generateCode() {
        return String.format("%06d", secureRandom.nextInt(1_000_000));
    }

    public String generateSalt() {
        byte[] salt = new byte[SALT_BYTES];
        secureRandom.nextBytes(salt);
        return toHex(salt);
    }

    public String hashCode(String email, EmailCodeScene scene, String salt, String code) {
        return toHex(hmac(hashKey, email + "\n" + scene.name() + "\n" + salt + "\n" + code));
    }

    public boolean matches(String expectedHash, String email, EmailCodeScene scene, String salt, String code) {
        if (expectedHash == null || code == null) {
            return false;
        }
        byte[] expected = fromHex(expectedHash);
        byte[] actual = fromHex(hashCode(email, scene, salt, code));
        return MessageDigest.isEqual(expected, actual);
    }

    public EncryptedCode encrypt(String code) {
        try {
            byte[] iv = new byte[GCM_IV_BYTES];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(encryptionKey, "AES"), new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(code.getBytes(StandardCharsets.UTF_8));
            return new EncryptedCode(
                    Base64.getUrlEncoder().withoutPadding().encodeToString(ciphertext),
                    Base64.getUrlEncoder().withoutPadding().encodeToString(iv));
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("验证码加密失败", ex);
        }
    }

    public String decrypt(String ciphertext, String encodedIv) {
        try {
            byte[] iv = Base64.getUrlDecoder().decode(encodedIv);
            byte[] encrypted = Base64.getUrlDecoder().decode(ciphertext);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(encryptionKey, "AES"), new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException ex) {
            throw new IllegalStateException("验证码解密失败", ex);
        }
    }

    public String stableLimitKey(String scope, String identity) {
        return toHex(hmac(hashKey, "rate-limit\n" + scope + "\n" + identity));
    }

    private byte[] deriveKey(byte[] masterKey, String label) {
        return hmac(masterKey, label);
    }

    private byte[] hmac(byte[] key, String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("验证码密钥初始化失败", ex);
        }
    }

    private String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(Character.forDigit((value >>> 4) & 0x0F, 16));
            builder.append(Character.forDigit(value & 0x0F, 16));
        }
        return builder.toString();
    }

    private byte[] fromHex(String value) {
        if (value == null || value.length() % 2 != 0) {
            return new byte[0];
        }
        byte[] result = new byte[value.length() / 2];
        for (int i = 0; i < value.length(); i += 2) {
            int high = Character.digit(value.charAt(i), 16);
            int low = Character.digit(value.charAt(i + 1), 16);
            if (high < 0 || low < 0) {
                return new byte[0];
            }
            result[i / 2] = (byte) ((high << 4) | low);
        }
        return result;
    }

    public static final class EncryptedCode {
        private final String ciphertext;
        private final String iv;

        public EncryptedCode(String ciphertext, String iv) {
            this.ciphertext = ciphertext;
            this.iv = iv;
        }

        public String getCiphertext() {
            return ciphertext;
        }

        public String getIv() {
            return iv;
        }
    }
}
