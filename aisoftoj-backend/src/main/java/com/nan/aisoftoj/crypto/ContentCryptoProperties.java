package com.nan.aisoftoj.crypto;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.content-crypto")
public class ContentCryptoProperties {

    private int maxPlaintextBytes = 8 * 1024 * 1024;
    private int maxPublicKeyHeaderChars = 1024;
    private int maxPublicKeyDerBytes = 512;

    public int getMaxPlaintextBytes() {
        return maxPlaintextBytes;
    }

    public void setMaxPlaintextBytes(int maxPlaintextBytes) {
        this.maxPlaintextBytes = maxPlaintextBytes;
    }

    public int getMaxPublicKeyHeaderChars() {
        return maxPublicKeyHeaderChars;
    }

    public void setMaxPublicKeyHeaderChars(int maxPublicKeyHeaderChars) {
        this.maxPublicKeyHeaderChars = maxPublicKeyHeaderChars;
    }

    public int getMaxPublicKeyDerBytes() {
        return maxPublicKeyDerBytes;
    }

    public void setMaxPublicKeyDerBytes(int maxPublicKeyDerBytes) {
        this.maxPublicKeyDerBytes = maxPublicKeyDerBytes;
    }
}
