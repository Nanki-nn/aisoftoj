package com.nan.aisoftoj.auth;

import com.nan.aisoftoj.common.UnauthorizedException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.client.RestOperations;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WeChatCodeExchangeClientTest {

    @Test
    void exchangesEncodedCodeWithoutReturningSessionKey() {
        RestOperations restOperations = mock(RestOperations.class);
        WeChatProperties properties = properties();
        WeChatCodeSessionResponse payload = new WeChatCodeSessionResponse();
        payload.setOpenId("openid-123");
        when(restOperations.getForObject(org.mockito.ArgumentMatchers.anyString(),
                eq(WeChatCodeSessionResponse.class))).thenReturn(payload);

        WeChatCodeExchangeClient client = new WeChatCodeExchangeClient(properties, restOperations);

        assertEquals("openid-123", client.exchangeForOpenId("code with + symbols"));
        ArgumentCaptor<String> url = ArgumentCaptor.forClass(String.class);
        verify(restOperations).getForObject(url.capture(), eq(WeChatCodeSessionResponse.class));
        assertTrue(
                url.getValue().contains("js_code=code%20with%20%2B%20symbols"),
                url.getValue());
    }

    @Test
    void mapsWechatErrorsToOneAuthenticationFailure() {
        RestOperations restOperations = mock(RestOperations.class);
        WeChatCodeSessionResponse payload = new WeChatCodeSessionResponse();
        payload.setErrorCode(40029);
        when(restOperations.getForObject(org.mockito.ArgumentMatchers.anyString(),
                eq(WeChatCodeSessionResponse.class))).thenReturn(payload);

        UnauthorizedException exception = assertThrows(
                UnauthorizedException.class,
                () -> new WeChatCodeExchangeClient(properties(), restOperations)
                        .exchangeForOpenId("bad-code"));

        assertEquals("微信登录失败，请重试", exception.getMessage());
    }

    private WeChatProperties properties() {
        WeChatProperties properties = new WeChatProperties();
        properties.setAppId("test-app-id");
        properties.setAppSecret("test-app-secret");
        properties.setCodeSessionUrl("https://api.weixin.qq.com/sns/jscode2session");
        return properties;
    }
}
