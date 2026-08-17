package com.nan.aisoftoj.service.impl;

import cn.hutool.core.util.StrUtil;
import com.nan.aisoftoj.common.ResourceNotFoundException;
import com.nan.aisoftoj.common.UserRole;
import com.nan.aisoftoj.dto.ai.AiProfileDTO;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import com.nan.aisoftoj.service.AiPlatformReadService;
import org.springframework.stereotype.Service;

@Service
public class AiPlatformReadServiceImpl implements AiPlatformReadService {

    private final UserMapper userMapper;
    private final PracticeSessionMapper practiceSessionMapper;
    private final UserWrongQuestionStatMapper wrongQuestionStatMapper;

    public AiPlatformReadServiceImpl(
            UserMapper userMapper,
            PracticeSessionMapper practiceSessionMapper,
            UserWrongQuestionStatMapper wrongQuestionStatMapper) {
        this.userMapper = userMapper;
        this.practiceSessionMapper = practiceSessionMapper;
        this.wrongQuestionStatMapper = wrongQuestionStatMapper;
    }

    @Override
    public AiProfileDTO getProfile(Integer userId) {
        User user = userMapper.selectById(userId);
        if (user == null || Boolean.TRUE.equals(user.getIsDeleted())) {
            throw new ResourceNotFoundException("用户不存在");
        }

        AiProfileDTO profile = new AiProfileDTO();
        profile.setUserId(user.getId());
        profile.setUsername(StrUtil.blankToDefault(user.getLoginName(), "user" + user.getId()));
        profile.setNickname(StrUtil.blankToDefault(user.getNickName(), null));
        profile.setRole(UserRole.normalize(user.getRole()));
        profile.setJoinDate(user.getCreateTime() == null ? null : user.getCreateTime().toInstant());
        profile.setLastLoginDate(
                user.getLastLoginTime() == null ? null : user.getLastLoginTime().toInstant());
        Long practiceCount = practiceSessionMapper.countPracticeHistoryByUserId(userId);
        Long wrongCount = wrongQuestionStatMapper.countByUserId(userId);
        profile.setPracticeSessionCount(practiceCount == null ? 0L : practiceCount);
        profile.setWrongQuestionCount(wrongCount == null ? 0L : wrongCount);
        return profile;
    }
}
