package com.nan.aisoftoj.crypto;

public class EncryptedContentResponse {

    private final int version;
    private final String algorithm;
    private final String encryptedKey;
    private final String iv;
    private final String ciphertext;

    public EncryptedContentResponse(
            int version,
            String algorithm,
            String encryptedKey,
            String iv,
            String ciphertext) {
        this.version = version;
        this.algorithm = algorithm;
        this.encryptedKey = encryptedKey;
        this.iv = iv;
        this.ciphertext = ciphertext;
    }

    public int getVersion() {
        return version;
    }

    public String getAlgorithm() {
        return algorithm;
    }

    public String getEncryptedKey() {
        return encryptedKey;
    }

    public String getIv() {
        return iv;
    }

    public String getCiphertext() {
        return ciphertext;
    }
}
