package com.nan.aisoftoj.service.impl;

import cn.hutool.core.util.StrUtil;
import com.nan.aisoftoj.auth.EmailCodeScene;
import com.nan.aisoftoj.auth.EmailNormalizer;
import com.nan.aisoftoj.common.ConflictException;
import com.nan.aisoftoj.common.InvalidEmailCodeException;
import com.nan.aisoftoj.common.UserRole;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.service.EmailCodeService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;

@Service
public class EmailBindingService {
    private final UserMapper userMapper;
    private final EmailCodeService emailCodeService;

    public EmailBindingService(UserMapper userMapper, EmailCodeService emailCodeService) {
        this.userMapper = userMapper;
        this.emailCodeService = emailCodeService;
    }

    @Transactional(
            rollbackFor = Exception.class,
            noRollbackFor = {InvalidEmailCodeException.class, ConflictException.class})
    public User bind(Integer currentUserId, String email, String code) {
        String normalizedEmail = EmailNormalizer.normalize(email);
        User current = userMapper.selectByIdForUpdate(currentUserId);
        requireActiveWechatUser(current);

        if (normalizedEmail.equals(current.getEmailNormalized())
                && current.getEmailVerifiedAt() != null) {
            return current;
        }
        if (StrUtil.isNotBlank(current.getEmail())
                || StrUtil.isNotBlank(current.getEmailNormalized())) {
            throw new ConflictException("当前微信账号已经绑定邮箱");
        }

        User existing = userMapper.selectAnyByNormalizedEmailForUpdate(normalizedEmail);
        emailCodeService.consumeCode(normalizedEmail, EmailCodeScene.BIND_EMAIL, code);
        if (existing != null) {
            throw new ConflictException("该邮箱已关联账号，需完成账号合并");
        }

        current.setEmail(normalizedEmail);
        current.setEmailNormalized(normalizedEmail);
        current.setEmailVerifiedAt(new Date());
        try {
            if (userMapper.updateById(current) != 1) {
                throw new IllegalStateException("绑定邮箱失败");
            }
        } catch (DuplicateKeyException ex) {
            throw new ConflictException("该邮箱已关联账号，需完成账号合并");
        }
        return current;
    }

    private void requireActiveWechatUser(User user) {
        if (user == null
                || Boolean.TRUE.equals(user.getIsDeleted())
                || !Boolean.TRUE.equals(user.getIsEnabled())
                || !UserRole.USER.name().equals(user.getRole())
                || StrUtil.isBlank(user.getWxOpenId())) {
            throw new IllegalArgumentException("当前账号不支持邮箱绑定");
        }
    }
}
