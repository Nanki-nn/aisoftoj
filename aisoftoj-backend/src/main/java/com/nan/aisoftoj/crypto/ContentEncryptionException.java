package com.nan.aisoftoj.crypto;

public class ContentEncryptionException extends RuntimeException {

    public ContentEncryptionException(String message) {
        super(message);
    }

    public ContentEncryptionException(String message, Throwable cause) {
        super(message, cause);
    }
}
