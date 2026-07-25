package com.nan.aisoftoj.crypto;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.method.HandlerMethod;

import java.lang.reflect.Method;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ContentPublicKeyInterceptorTest {

    private ContentPublicKeyInterceptor interceptor;
    private HandlerMethod handlerMethod;

    @BeforeEach
    void setUp() throws Exception {
        interceptor = new ContentPublicKeyInterceptor(new ContentCryptoProperties());
        Method method = TestController.class.getDeclaredMethod("encrypted");
        handlerMethod = new HandlerMethod(new TestController(), method);
    }

    @Test
    void acceptsCanonical2048BitRsaPublicKey() throws Exception {
        MockHttpServletRequest request = encryptedRequest(generatePublicKey(2048));

        interceptor.preHandle(request, new MockHttpServletResponse(), handlerMethod);

        assertNotNull(request.getAttribute(ContentCryptoHeaders.REQUEST_PUBLIC_KEY_ATTRIBUTE));
    }

    @Test
    void rejectsMissingVersionBeforeController() {
        MockHttpServletRequest request = new MockHttpServletRequest();

        assertThrows(
                InvalidContentCryptoKeyException.class,
                () -> interceptor.preHandle(request, new MockHttpServletResponse(), handlerMethod));
    }

    @Test
    void rejectsPaddedAndSmallPublicKeys() throws Exception {
        MockHttpServletRequest padded = encryptedRequest(generatePublicKey(2048) + "=");
        MockHttpServletRequest small = encryptedRequest(generatePublicKey(1024));

        assertThrows(
                InvalidContentCryptoKeyException.class,
                () -> interceptor.preHandle(padded, new MockHttpServletResponse(), handlerMethod));
        assertThrows(
                InvalidContentCryptoKeyException.class,
                () -> interceptor.preHandle(small, new MockHttpServletResponse(), handlerMethod));
    }

    private MockHttpServletRequest encryptedRequest(String publicKey) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(ContentCryptoHeaders.REQUEST_VERSION, "1");
        request.addHeader(ContentCryptoHeaders.REQUEST_PUBLIC_KEY, publicKey);
        return request;
    }

    private String generatePublicKey(int bits) throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(bits);
        KeyPair pair = generator.generateKeyPair();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(pair.getPublic().getEncoded());
    }

    private static class TestController {
        @EncryptedQuestionResponse
        public ResultDTOHolder encrypted() {
            return null;
        }
    }

    private static class ResultDTOHolder {
    }
}
