package com.nan.aisoftoj.crypto;

public final class ContentCryptoHeaders {

    public static final String REQUEST_VERSION = "X-Content-Crypto-Version";
    public static final String REQUEST_PUBLIC_KEY = "X-Content-Public-Key";
    public static final String RESPONSE_ENCRYPTED = "X-Content-Encrypted";
    public static final String REQUEST_PUBLIC_KEY_ATTRIBUTE =
            ContentCryptoHeaders.class.getName() + ".publicKey";
    public static final String PROTOCOL_VERSION = "1";
    public static final String ALGORITHM = "RSA-OAEP-256+A256GCM";

    private ContentCryptoHeaders() {
    }
}
