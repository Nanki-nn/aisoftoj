package com.nan.aisoftoj.auth;

import cn.hutool.core.util.StrUtil;
import com.nan.aisoftoj.common.UnauthorizedException;
import org.springframework.stereotype.Component;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestOperations;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;

@Component
public class WeChatCodeExchangeClient {
    private final WeChatProperties properties;
    private final RestOperations restOperations;

    public WeChatCodeExchangeClient(WeChatProperties properties) {
        this(properties, createRestTemplate(properties));
    }

    WeChatCodeExchangeClient(WeChatProperties properties, RestOperations restOperations) {
        this.properties = properties;
        this.restOperations = restOperations;
    }

    public String exchangeForOpenId(String code) {
        properties.ensureConfigured();
        String url = UriComponentsBuilder.fromHttpUrl(properties.getCodeSessionUrl())
                .queryParam("appid", encode(properties.getAppId()))
                .queryParam("secret", encode(properties.getAppSecret()))
                .queryParam("js_code", encode(code))
                .queryParam("grant_type", "authorization_code")
                .build(true)
                .toUriString();
        try {
            WeChatCodeSessionResponse response = restOperations.getForObject(
                    url, WeChatCodeSessionResponse.class);
            if (response == null
                    || response.getErrorCode() != null
                    || StrUtil.isBlank(response.getOpenId())) {
                throw authenticationFailure();
            }
            return response.getOpenId();
        } catch (UnauthorizedException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw authenticationFailure();
        }
    }

    private UnauthorizedException authenticationFailure() {
        return new UnauthorizedException("微信登录失败，请重试");
    }

    private String encode(String value) {
        return UriUtils.encode(value, StandardCharsets.UTF_8);
    }

    private static RestTemplate createRestTemplate(WeChatProperties properties) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(properties.getConnectTimeoutMs());
        requestFactory.setReadTimeout(properties.getReadTimeoutMs());
        return new RestTemplate(requestFactory);
    }
}
