package com.nan.aisoftoj.service.impl;

import cn.hutool.core.date.DateUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.crypto.digest.BCrypt;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
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

import java.util.Date;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthServiceImpl implements AuthService {

    private static final ConcurrentHashMap<String, Integer> TOKEN_STORE = new ConcurrentHashMap<>();

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
        user.setIsEnabled(true);
        user.setIsDeleted(false);
        userMapper.insert(user);
        return buildAuthResponse(user);
    }

    @Override
    public AuthUserDTO getCurrentUser(String token) {
        Integer userId = getUserIdByToken(token);
        User user = userMapper.selectById(userId);
        if (user == null || Boolean.TRUE.equals(user.getIsDeleted())) {
            throw new IllegalArgumentException("用户不存在");
        }
        return buildUserDTO(user);
    }

    @Override
    public void logout(String token) {
        if (StrUtil.isNotBlank(token)) {
            TOKEN_STORE.remove(token);
        }
    }

    private AuthResponse buildAuthResponse(User user) {
        String token = UUID.randomUUID().toString().replace("-", "");
        TOKEN_STORE.put(token, user.getId());
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
        if (StrUtil.isBlank(token)) {
            throw new IllegalArgumentException("未登录或登录已过期");
        }
        Integer userId = TOKEN_STORE.get(token);
        if (userId == null) {
            throw new IllegalArgumentException("未登录或登录已过期");
        }
        return userId;
    }
}
