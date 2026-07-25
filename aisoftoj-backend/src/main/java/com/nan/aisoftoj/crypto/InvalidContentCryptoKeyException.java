package com.nan.aisoftoj.crypto;

public class InvalidContentCryptoKeyException extends RuntimeException {

    public InvalidContentCryptoKeyException(String message) {
        super(message);
    }

    public InvalidContentCryptoKeyException(String message, Throwable cause) {
        super(message, cause);
    }
}
