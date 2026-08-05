package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.auth.EmailCodeCrypto;
import com.nan.aisoftoj.auth.EmailCodeScene;
import com.nan.aisoftoj.common.TooManyRequestsException;
import com.nan.aisoftoj.entity.AuthRateLimit;
import com.nan.aisoftoj.mapper.AuthRateLimitMapper;
import com.nan.aisoftoj.service.AuthRateLimitService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class AuthRateLimitServiceImpl implements AuthRateLimitService {
    private final AuthRateLimitMapper rateLimitMapper;
    private final EmailCodeCrypto crypto;

    public AuthRateLimitServiceImpl(AuthRateLimitMapper rateLimitMapper, EmailCodeCrypto crypto) {
        this.rateLimitMapper = rateLimitMapper;
        this.crypto = crypto;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void acquireEmailCodeLimits(String normalizedEmail, EmailCodeScene scene, String requestIp) {
        List<LimitSpec> limits = new ArrayList<>();
        limits.add(limit("email-code-cooldown:" + scene.name(), normalizedEmail, 1, Duration.ofSeconds(60)));
        limits.add(limit("email-code-hour:" + scene.name(), normalizedEmail, 6, Duration.ofHours(1)));
        limits.add(limit("email-code-ip-hour:" + scene.name(), requestIp, 30, Duration.ofHours(1)));
        acquireAll(limits, "操作过于频繁，请稍后再试");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void acquirePasswordLoginLimits(String normalizedEmail, String requestIp) {
        List<LimitSpec> limits = new ArrayList<>();
        limits.add(limit("password-login-email", normalizedEmail, 10, Duration.ofMinutes(15)));
        limits.add(limit("password-login-ip", requestIp, 50, Duration.ofMinutes(15)));
        acquireAll(limits, "登录尝试过于频繁，请 15 分钟后再试");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void acquireWechatCodeExchangeLimit(String requestIp) {
        List<LimitSpec> limits = new ArrayList<>();
        limits.add(limit("wechat-code-ip", requestIp, 50, Duration.ofMinutes(15)));
        acquireAll(limits, "微信登录尝试过于频繁，请稍后再试");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void acquireWechatOpenIdLoginLimit(String openId) {
        List<LimitSpec> limits = new ArrayList<>();
        limits.add(limit("wechat-openid", openId, 20, Duration.ofMinutes(15)));
        acquireAll(limits, "微信登录尝试过于频繁，请稍后再试");
    }

    private LimitSpec limit(String scope, String identity, int maximum, Duration duration) {
        return new LimitSpec(crypto.stableLimitKey(scope, identity), maximum, duration);
    }

    private void acquireAll(List<LimitSpec> limits, String errorMessage) {
        limits.sort(Comparator.comparing(LimitSpec::getKey));
        LocalDateTime now = LocalDateTime.now();
        for (LimitSpec spec : limits) {
            LocalDateTime initialExpiry = now.plus(spec.getDuration());
            rateLimitMapper.insertIgnore(spec.getKey(), now, initialExpiry);
            AuthRateLimit state = rateLimitMapper.selectForUpdate(spec.getKey());
            if (state == null) {
                throw new IllegalStateException("认证限流状态创建失败");
            }

            if (!state.getExpiresAt().isAfter(now)) {
                rateLimitMapper.updateWindow(spec.getKey(), 1, now, initialExpiry, now);
                continue;
            }
            if (state.getCounter() >= spec.getMaximum()) {
                throw new TooManyRequestsException(errorMessage);
            }
            rateLimitMapper.updateWindow(
                    spec.getKey(),
                    state.getCounter() + 1,
                    state.getWindowStart(),
                    state.getExpiresAt(),
                    now);
        }
    }

    private static final class LimitSpec {
        private final String key;
        private final int maximum;
        private final Duration duration;

        private LimitSpec(String key, int maximum, Duration duration) {
            this.key = key;
            this.maximum = maximum;
            this.duration = duration;
        }

        private String getKey() {
            return key;
        }

        private int getMaximum() {
            return maximum;
        }

        private Duration getDuration() {
            return duration;
        }
    }
}
