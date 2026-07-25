package com.nan.aisoftoj.config;

import com.nan.aisoftoj.crypto.ContentCryptoHeaders;
import com.nan.aisoftoj.crypto.ContentPublicKeyInterceptor;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class WebConfigTest {

    @Test
    @SuppressWarnings("unchecked")
    void exposesEncryptedResponseMarkerToBrowserCode() {
        WebConfig webConfig = new WebConfig(mock(ContentPublicKeyInterceptor.class));
        ReflectionTestUtils.setField(
                webConfig,
                "allowedOrigins",
                "http://localhost:3000");
        CorsRegistry registry = new CorsRegistry();

        webConfig.addCorsMappings(registry);

        Map<String, CorsConfiguration> configurations =
                (Map<String, CorsConfiguration>) ReflectionTestUtils.invokeMethod(
                        registry,
                        "getCorsConfigurations");
        assertNotNull(configurations);
        CorsConfiguration configuration = configurations.get("/**");
        assertNotNull(configuration);
        assertTrue(configuration.getAllowedHeaders().contains("*"));
        assertTrue(configuration.getExposedHeaders().contains(
                ContentCryptoHeaders.RESPONSE_ENCRYPTED));
    }
}
