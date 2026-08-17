package com.nan.aisoftoj.ai;

import cn.hutool.core.util.StrUtil;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "ai.internal")
public class AiInternalProperties implements InitializingBean {

    private String serviceKey;

    public String getServiceKey() {
        return serviceKey;
    }

    public void setServiceKey(String serviceKey) {
        this.serviceKey = serviceKey;
    }

    @Override
    public void afterPropertiesSet() {
        if (StrUtil.isBlank(serviceKey)) {
            throw new IllegalStateException("AI_INTERNAL_SERVICE_KEY 未配置");
        }
    }
}
