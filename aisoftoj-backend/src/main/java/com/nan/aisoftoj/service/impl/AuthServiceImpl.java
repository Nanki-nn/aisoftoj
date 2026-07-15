package com.nan.aisoftoj.service.impl;

import cn.hutool.core.date.DateUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.crypto.digest.BCrypt;
import cn.hutool.jwt.JWT;
import cn.hutool.jwt.JWTUtil;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.nan.aisoftoj.common.ForbiddenException;
import com.nan.aisoftoj.common.UnauthorizedException;
import com.nan.aisoftoj.common.UserRole;
import com.nan.aisoftoj.dto.AuthLoginRequest;
import com.nan.aisoftoj.dto.AuthRegisterRequest;
import com.nan.aisoftoj.dto.AuthResponse;
import com.nan.aisoftoj.dto.AuthUserDTO;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import com.nan.aisoftoj.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
public class AuthServiceImpl implements AuthService {

    @Value("${auth.jwt.secret}")
    private String jwtSecret;

    @Value("${auth.jwt.expire-hours:168}")
    private Long jwtExpireHours;

    @Autowired
    private UserMapper userMapper;
    @Autowired
    private PracticeSessionMapper practiceSessionMapper;
    @Autowired
    private UserWrongQuestionStatMapper userWrongQuestionStatMapper;

    @Override
    public AuthResponse login(AuthLoginRequest request) {
        User user = userMapper.selectOne(Wrappers.lambdaQuery(User.class)
                .eq(User::getEmail, request.getEmail())
                .eq(User::getIsDeleted, false)
                .last("LIMIT 1"));
        if (user == null || !Boolean.TRUE.equals(user.getIsEnabled())) {
            throw new IllegalArgumentException("账号不存在或已被禁用");
        }
        if (StrUtil.isBlank(user.getPassword()) || !BCrypt.checkpw(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("邮箱或密码错误");
        }
        return buildAuthResponse(user);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AuthResponse register(AuthRegisterRequest request) {
        if (!StrUtil.equals(request.getPassword(), request.getConfirmPassword())) {
            throw new IllegalArgumentException("两次输入的密码不一致");
        }
        User emailUser = userMapper.selectOne(Wrappers.lambdaQuery(User.class)
                .eq(User::getEmail, request.getEmail())
                .eq(User::getIsDeleted, false)
                .last("LIMIT 1"));
        if (emailUser != null) {
            throw new IllegalArgumentException("该邮箱已被注册");
        }
        User loginNameUser = userMapper.selectOne(Wrappers.lambdaQuery(User.class)
                .eq(User::getLoginName, request.getUsername())
                .eq(User::getIsDeleted, false)
                .last("LIMIT 1"));
        if (loginNameUser != null) {
            throw new IllegalArgumentException("该用户名已存在");
        }

        User user = new User();
        user.setLoginName(request.getUsername());
        user.setEmail(request.getEmail());
        user.setNickName(request.getNickname());
        user.setPhone(StrUtil.blankToDefault(request.getPhone(), null));
        user.setAvatar("https://api.dicebear.com/7.x/avataaars/svg?seed=" + request.getUsername());
        user.setPassword(BCrypt.hashpw(request.getPassword()));
        user.setRole(UserRole.USER.name());
        user.setIsEnabled(true);
        user.setIsDeleted(false);
        userMapper.insert(user);
        return buildAuthResponse(user);
    }

    @Override
    public AuthUserDTO getCurrentUser(String token) {
        return buildUserDTO(getActiveUserByToken(token));
    }

    @Override
    public Integer getCurrentUserId(String token) {
        return getActiveUserByToken(token).getId();
    }

    @Override
    public Integer requireAdmin(String token) {
        User user = getActiveUserByToken(token);
        if (!UserRole.isAdmin(user.getRole())) {
            throw new ForbiddenException("需要管理员权限");
        }
        return user.getId();
    }

    @Override
    public void logout(String token) {
        // JWT 为无状态令牌，前端删除本地令牌即可完成退出。
    }

    private AuthResponse buildAuthResponse(User user) {
        String token = createToken(user.getId());
        AuthResponse response = new AuthResponse();
        response.setToken(token);
        response.setUser(buildUserDTO(user));
        return response;
    }

    private AuthUserDTO buildUserDTO(User user) {
        AuthUserDTO dto = new AuthUserDTO();
        dto.setId(String.valueOf(user.getId()));
        dto.setUsername(StrUtil.blankToDefault(user.getLoginName(), "user" + user.getId()));
        dto.setEmail(StrUtil.blankToDefault(user.getEmail(), ""));
        dto.setNickname(StrUtil.blankToDefault(user.getNickName(), dto.getUsername()));
        dto.setAvatar(user.getAvatar());
        dto.setPhone(user.getPhone());
        dto.setRole(UserRole.normalize(user.getRole()));
        String joinDate = user.getCreateTime() == null ? DateUtil.today() : DateUtil.formatDate(user.getCreateTime());
        dto.setJoinDate(joinDate);
        dto.setLastLoginDate(DateUtil.formatDate(new Date()));
        Long totalExams = practiceSessionMapper.selectCount(Wrappers.lambdaQuery(com.nan.aisoftoj.entity.PracticeSession.class)
                .eq(com.nan.aisoftoj.entity.PracticeSession::getUserId, user.getId())
                .eq(com.nan.aisoftoj.entity.PracticeSession::getIsDeleted, false));
        Long totalQuestions = userWrongQuestionStatMapper.selectCount(Wrappers.lambdaQuery(com.nan.aisoftoj.entity.UserWrongQuestionStat.class)
                .eq(com.nan.aisoftoj.entity.UserWrongQuestionStat::getUserId, user.getId())
                .eq(com.nan.aisoftoj.entity.UserWrongQuestionStat::getIsDeleted, false));
        dto.setTotalExams(totalExams == null ? 0 : totalExams.intValue());
        dto.setTotalQuestions(totalQuestions == null ? 0 : totalQuestions.intValue());
        dto.setCorrectAnswers(0);
        dto.setAccuracy(0);
        dto.setStudyDays(1);
        dto.setLevel("beginner");
        dto.setPoints(0);
        dto.setBadges(new String[]{"新手上路"});
        return dto;
    }

    private Integer getUserIdByToken(String token) {
        String normalizedToken = normalizeToken(token);
        if (StrUtil.isBlank(normalizedToken)) {
            throw unauthorized();
        }

        byte[] secretBytes = getSecretBytes();
        try {
            if (!JWTUtil.verify(normalizedToken, secretBytes)) {
                throw unauthorized();
            }

            JWT jwt = JWTUtil.parseToken(normalizedToken);
            Object expiresAt = jwt.getPayload("exp");
            Object userId = jwt.getPayload("userId");
            if (expiresAt == null || userId == null) {
                throw unauthorized();
            }

            long expireAtMillis = Long.parseLong(String.valueOf(expiresAt));
            if (expireAtMillis <= System.currentTimeMillis()) {
                throw unauthorized();
            }

            return Integer.parseInt(String.valueOf(userId));
        } catch (UnauthorizedException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            throw unauthorized();
        }
    }

    private User getActiveUserByToken(String token) {
        Integer userId = getUserIdByToken(token);
        User user = userMapper.selectById(userId);
        if (user == null
                || Boolean.TRUE.equals(user.getIsDeleted())
                || !Boolean.TRUE.equals(user.getIsEnabled())) {
            throw unauthorized();
        }
        return user;
    }

    private UnauthorizedException unauthorized() {
        return new UnauthorizedException("未登录或登录已过期");
    }

    private String createToken(Integer userId) {
        long expireAt = System.currentTimeMillis() + jwtExpireHours * 60 * 60 * 1000;
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", userId);
        payload.put("exp", expireAt);
        payload.put("iat", System.currentTimeMillis());
        return JWTUtil.createToken(payload, getSecretBytes());
    }

    private byte[] getSecretBytes() {
        if (StrUtil.isBlank(jwtSecret)) {
            throw new IllegalStateException("JWT 密钥未配置");
        }
        return jwtSecret.getBytes(StandardCharsets.UTF_8);
    }

    private String normalizeToken(String token) {
        if (StrUtil.isBlank(token)) {
            return null;
        }
        String trimmed = token.trim();
        if (trimmed.startsWith("Bearer ")) {
            return trimmed.substring(7).trim();
        }
        return trimmed;
    }
}
