package com.nan.aisoftoj.crypto;

import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.math.BigInteger;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

@Component
public class ContentPublicKeyInterceptor implements HandlerInterceptor {

    private static final BigInteger REQUIRED_PUBLIC_EXPONENT = BigInteger.valueOf(65537L);

    private final ContentCryptoProperties properties;

    public ContentPublicKeyInterceptor(ContentCryptoProperties properties) {
        this.properties = properties;
    }

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler) {
        if (!(handler instanceof HandlerMethod)) {
            return true;
        }

        HandlerMethod handlerMethod = (HandlerMethod) handler;
        if (!handlerMethod.hasMethodAnnotation(EncryptedQuestionResponse.class)) {
            return true;
        }

        String version = request.getHeader(ContentCryptoHeaders.REQUEST_VERSION);
        if (!ContentCryptoHeaders.PROTOCOL_VERSION.equals(version)) {
            throw invalidKey("不支持的题目数据加密协议");
        }

        String encodedKey = request.getHeader(ContentCryptoHeaders.REQUEST_PUBLIC_KEY);
        PublicKey publicKey = parsePublicKey(encodedKey);
        request.setAttribute(ContentCryptoHeaders.REQUEST_PUBLIC_KEY_ATTRIBUTE, publicKey);
        return true;
    }

    private PublicKey parsePublicKey(String encodedKey) {
        if (encodedKey == null || encodedKey.isEmpty()) {
            throw invalidKey("缺少题目数据加密公钥");
        }
        if (encodedKey.length() > properties.getMaxPublicKeyHeaderChars()) {
            throw invalidKey("题目数据加密公钥过长");
        }
        if (!encodedKey.matches("^[A-Za-z0-9_-]+$")) {
            throw invalidKey("题目数据加密公钥编码不合法");
        }

        try {
            byte[] der = Base64.getUrlDecoder().decode(encodedKey);
            if (der.length > properties.getMaxPublicKeyDerBytes()) {
                throw invalidKey("题目数据加密公钥过大");
            }
            if (!Base64.getUrlEncoder().withoutPadding().encodeToString(der).equals(encodedKey)) {
                throw invalidKey("题目数据加密公钥编码不规范");
            }

            PublicKey publicKey = KeyFactory.getInstance("RSA")
                    .generatePublic(new X509EncodedKeySpec(der));
            if (!(publicKey instanceof RSAPublicKey)) {
                throw invalidKey("题目数据加密公钥算法不合法");
            }

            RSAPublicKey rsaPublicKey = (RSAPublicKey) publicKey;
            if (rsaPublicKey.getModulus().bitLength() != 2048
                    || !REQUIRED_PUBLIC_EXPONENT.equals(rsaPublicKey.getPublicExponent())) {
                throw invalidKey("题目数据加密公钥参数不合法");
            }
            return rsaPublicKey;
        } catch (InvalidContentCryptoKeyException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new InvalidContentCryptoKeyException("题目数据加密公钥无效", ex);
        }
    }

    private InvalidContentCryptoKeyException invalidKey(String message) {
        return new InvalidContentCryptoKeyException(message);
    }
}
