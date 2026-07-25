package com.nan.aisoftoj.crypto;

public class ContentCryptoPayloadTooLargeException extends RuntimeException {

    public ContentCryptoPayloadTooLargeException(String message) {
        super(message);
    }

    public ContentCryptoPayloadTooLargeException(String message, Throwable cause) {
        super(message, cause);
    }
}
