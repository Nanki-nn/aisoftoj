package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.dto.ai.AiProfileDTO;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiPlatformReadServiceImplTest {

    @Mock
    private UserMapper userMapper;
    @Mock
    private PracticeSessionMapper practiceSessionMapper;
    @Mock
    private UserWrongQuestionStatMapper wrongQuestionStatMapper;
    @InjectMocks
    private AiPlatformReadServiceImpl service;

    @Test
    void profileContainsOnlyReliableIdentityAndCounts() {
        Instant created = Instant.parse("2026-08-01T00:00:00Z");
        User user = new User();
        user.setId(9);
        user.setLoginName("reader");
        user.setNickName(null);
        user.setRole("USER");
        user.setIsDeleted(false);
        user.setCreateTime(Date.from(created));
        when(userMapper.selectById(9)).thenReturn(user);
        when(practiceSessionMapper.countPracticeHistoryByUserId(9)).thenReturn(12L);
        when(wrongQuestionStatMapper.countByUserId(9)).thenReturn(4L);

        AiProfileDTO profile = service.getProfile(9);

        assertEquals(9, profile.getUserId());
        assertEquals("reader", profile.getUsername());
        assertNull(profile.getNickname());
        assertEquals("USER", profile.getRole());
        assertEquals(created, profile.getJoinDate());
        assertEquals(12L, profile.getPracticeSessionCount());
        assertEquals(4L, profile.getWrongQuestionCount());
    }
}
