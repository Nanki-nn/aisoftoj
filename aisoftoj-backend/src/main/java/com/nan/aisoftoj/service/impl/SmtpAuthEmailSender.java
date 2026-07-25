package com.nan.aisoftoj.service.impl;

import cn.hutool.core.util.StrUtil;
import com.nan.aisoftoj.auth.AuthEmailProperties;
import com.nan.aisoftoj.auth.EmailCodeScene;
import com.nan.aisoftoj.common.EmailDeliveryUnavailableException;
import com.nan.aisoftoj.service.AuthEmailSender;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import javax.mail.MessagingException;
import javax.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;

@Service
public class SmtpAuthEmailSender implements AuthEmailSender {
    private final JavaMailSender mailSender;
    private final AuthEmailProperties properties;
    private final String mailHost;

    public SmtpAuthEmailSender(
            JavaMailSender mailSender,
            AuthEmailProperties properties,
            @Value("${spring.mail.host:}") String mailHost) {
        this.mailSender = mailSender;
        this.properties = properties;
        this.mailHost = mailHost;
    }

    @Override
    public void ensureConfigured() {
        if (StrUtil.isBlank(mailHost) || StrUtil.isBlank(properties.getFrom())) {
            throw new EmailDeliveryUnavailableException("邮件服务暂不可用，请稍后重试");
        }
    }

    @Override
    public void sendCode(String email, EmailCodeScene scene, String code) {
        ensureConfigured();
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(properties.getFrom(), properties.getFromName());
            helper.setTo(email);
            helper.setSubject("知构软考 - " + scene.getDescription() + "验证码");
            helper.setText(buildPlainText(scene, code), buildHtml(scene, code));
            mailSender.send(message);
        } catch (MessagingException | java.io.UnsupportedEncodingException ex) {
            throw new EmailDeliveryUnavailableException("邮件发送失败，请稍后重试");
        }
    }

    private String buildPlainText(EmailCodeScene scene, String code) {
        return "你正在" + scene.getDescription() + "。\n\n验证码：" + code
                + "\n\n验证码 10 分钟内有效，请勿转发。若非本人操作，请忽略本邮件。";
    }

    private String buildHtml(EmailCodeScene scene, String code) {
        return "<div style=\"font-family:Arial,sans-serif;color:#1e293b;line-height:1.7\">"
                + "<h2 style=\"margin:0 0 16px\">知构软考</h2>"
                + "<p>你正在" + scene.getDescription() + "。</p>"
                + "<div style=\"font-size:28px;font-weight:700;letter-spacing:6px;margin:20px 0;color:#2563eb\">"
                + code + "</div>"
                + "<p style=\"color:#64748b\">验证码 10 分钟内有效，请勿转发。若非本人操作，请忽略本邮件。</p>"
                + "</div>";
    }
}
