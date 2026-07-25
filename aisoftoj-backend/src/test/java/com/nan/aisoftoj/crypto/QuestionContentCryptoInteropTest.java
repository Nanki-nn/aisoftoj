package com.nan.aisoftoj.crypto;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nan.aisoftoj.dto.ResultDTO;
import org.junit.jupiter.api.Test;

import java.io.BufferedReader;
import java.io.OutputStreamWriter;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class QuestionContentCryptoInteropTest {

    @Test
    void nodeWebCryptoDecryptsEnvelopeProducedByJavaService() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        ContentCryptoProperties properties = new ContentCryptoProperties();
        QuestionContentEncryptionService service = new QuestionContentEncryptionService(
                objectMapper,
                properties);
        service.verifyCryptoRuntime();

        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair keyPair = generator.generateKeyPair();
        ResultDTO<?> original = ResultDTO.success("跨运行时题目内容");
        EncryptedContentResponse envelope = service.encrypt(original, keyPair.getPublic());

        Map<String, Object> fixture = new LinkedHashMap<>();
        fixture.put("privateKey", Base64.getUrlEncoder().withoutPadding()
                .encodeToString(keyPair.getPrivate().getEncoded()));
        fixture.put("envelope", envelope);
        fixture.put("expected", original);

        String script = Paths.get("src", "test", "resources", "verify-content-crypto.mjs")
                .toAbsolutePath().toString();
        Process process = new ProcessBuilder("node", script)
                .redirectErrorStream(true)
                .start();
        try (OutputStreamWriter writer = new OutputStreamWriter(
                process.getOutputStream(), StandardCharsets.UTF_8)) {
            writer.write(objectMapper.writeValueAsString(fixture));
        }

        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append('\n');
            }
        }

        assertEquals(0, process.waitFor(), output.toString());
    }
}
