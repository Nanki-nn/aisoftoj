package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.dto.ai.AiQuestionDTO;
import com.nan.aisoftoj.dto.ai.AiProfileDTO;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.mapper.PaperMapper;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.PracticeSessionQuestionRecordMapper;
import com.nan.aisoftoj.mapper.QuestionMapper;
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
    @Mock
    private PaperMapper paperMapper;
    @Mock
    private QuestionMapper questionMapper;
    @Mock
    private PracticeSessionQuestionRecordMapper questionRecordMapper;
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

    @Test
    void questionSupportsCurrentOptionFields() {
        Question question = questionWithOptions(1027,
                "[{\"key\":\"A\",\"text\":\"services\"},"
                        + "{\"key\":\"B\",\"text\":\"architectures\"}]");
        when(questionMapper.selectById(1027)).thenReturn(question);
        when(questionMapper.countPublishedPaperRelations(1027)).thenReturn(1);

        AiQuestionDTO result = service.getQuestion(1027);

        assertEquals(1027, result.getQuestionId());
        assertEquals("A", result.getOptions().get(0).getKey());
        assertEquals("services", result.getOptions().get(0).getContent());
        assertEquals("B", result.getOptions().get(1).getKey());
        assertEquals("architectures", result.getOptions().get(1).getContent());
    }

    @Test
    void questionSupportsLegacyOptionFieldsAndOrder() {
        Question question = questionWithOptions(8,
                "[{\"keyStr\":\"A\",\"valueStr\":\"first\",\"orderNum\":2},"
                        + "{\"keyStr\":\"B\",\"valueStr\":\"second\",\"orderNum\":1}]");
        when(questionMapper.selectById(8)).thenReturn(question);
        when(questionMapper.countPublishedPaperRelations(8)).thenReturn(1);

        AiQuestionDTO result = service.getQuestion(8);

        assertEquals("B", result.getOptions().get(0).getKey());
        assertEquals("second", result.getOptions().get(0).getContent());
        assertEquals("A", result.getOptions().get(1).getKey());
        assertEquals("first", result.getOptions().get(1).getContent());
    }

    @Test
    void questionPrefersCurrentFieldsAndFallsBackWhenTheyAreBlank() {
        Question question = questionWithOptions(9,
                "[{\"key\":\"A\",\"text\":\"current\","
                        + "\"keyStr\":\"X\",\"valueStr\":\"legacy\"},"
                        + "{\"key\":\"  \",\"text\":\"  \","
                        + "\"keyStr\":\"B\",\"valueStr\":\"fallback\"}]");
        when(questionMapper.selectById(9)).thenReturn(question);
        when(questionMapper.countPublishedPaperRelations(9)).thenReturn(1);

        AiQuestionDTO result = service.getQuestion(9);

        assertEquals("A", result.getOptions().get(0).getKey());
        assertEquals("current", result.getOptions().get(0).getContent());
        assertEquals("B", result.getOptions().get(1).getKey());
        assertEquals("fallback", result.getOptions().get(1).getContent());
    }

    private static Question questionWithOptions(int questionId, String options) {
        Question question = new Question();
        question.setId(questionId);
        question.setName("Question " + questionId);
        question.setIntro("Question content");
        question.setOptions(options);
        question.setQuestionType(1);
        question.setDifficulty(2);
        question.setIsDeleted(0);
        return question;
    }
}
