package com.nan.aisoftoj.service.impl;

import cn.hutool.json.JSONUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.nan.aisoftoj.common.ResourceNotFoundException;
import com.nan.aisoftoj.common.UserRole;
import com.nan.aisoftoj.consts.PaperCate;
import com.nan.aisoftoj.consts.PaperStatus;
import com.nan.aisoftoj.consts.PracticeSessionState;
import com.nan.aisoftoj.dto.Option;
import com.nan.aisoftoj.dto.ai.AiPaperDTO;
import com.nan.aisoftoj.dto.ai.AiProfileDTO;
import com.nan.aisoftoj.dto.ai.AiQuestionDTO;
import com.nan.aisoftoj.dto.ai.AiQuestionOptionDTO;
import com.nan.aisoftoj.entity.Paper;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.mapper.PaperMapper;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.QuestionMapper;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import com.nan.aisoftoj.service.AiPlatformReadService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AiPlatformReadServiceImpl implements AiPlatformReadService {

    private final UserMapper userMapper;
    private final PracticeSessionMapper practiceSessionMapper;
    private final UserWrongQuestionStatMapper wrongQuestionStatMapper;
    private final PaperMapper paperMapper;
    private final QuestionMapper questionMapper;

    public AiPlatformReadServiceImpl(
            UserMapper userMapper,
            PracticeSessionMapper practiceSessionMapper,
            UserWrongQuestionStatMapper wrongQuestionStatMapper,
            PaperMapper paperMapper,
            QuestionMapper questionMapper) {
        this.userMapper = userMapper;
        this.practiceSessionMapper = practiceSessionMapper;
        this.wrongQuestionStatMapper = wrongQuestionStatMapper;
        this.paperMapper = paperMapper;
        this.questionMapper = questionMapper;
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

    @Override
    public List<AiPaperDTO> listPapers(Integer userId) {
        List<Paper> papers = paperMapper.selectList(Wrappers.lambdaQuery(Paper.class)
                .eq(Paper::getIsDeleted, false)
                .eq(Paper::getPublishStatus, true)
                .orderByDesc(Paper::getPaperYear)
                .orderByDesc(Paper::getPaperMonth)
                .orderByDesc(Paper::getId));
        List<PracticeSession> sessions = practiceSessionMapper.selectList(
                Wrappers.lambdaQuery(PracticeSession.class)
                        .eq(PracticeSession::getUserId, userId)
                        .eq(PracticeSession::getIsDeleted, false)
                        .in(PracticeSession::getStatus,
                                PracticeSessionState.DOING.getCode(),
                                PracticeSessionState.FINISHED.getCode()));
        Map<Integer, List<PracticeSession>> byPaper = sessions.stream()
                .collect(Collectors.groupingBy(PracticeSession::getPaperId));
        return papers.stream()
                .map(paper -> toPaperDTO(paper,
                        byPaper.getOrDefault(paper.getId(), Collections.emptyList())))
                .collect(Collectors.toList());
    }

    @Override
    public AiQuestionDTO getQuestion(Integer questionId) {
        if (questionId == null || questionId <= 0) {
            throw new IllegalArgumentException("questionId 必须为正整数");
        }
        Question question = questionMapper.selectById(questionId);
        if (question == null
                || question.getIsDeleted() == null
                || question.getIsDeleted() != 0
                || questionMapper.countPublishedPaperRelations(questionId) == 0) {
            throw new ResourceNotFoundException("题目不存在或暂未发布");
        }
        AiQuestionDTO dto = new AiQuestionDTO();
        dto.setQuestionId(question.getId());
        dto.setName(question.getName());
        dto.setContent(question.getIntro());
        dto.setOptions(parseOptions(question.getOptions()));
        dto.setQuestionType(mapQuestionType(question.getQuestionType()));
        dto.setDifficulty(mapDifficulty(question.getDifficulty()));
        return dto;
    }

    private AiPaperDTO toPaperDTO(Paper paper, List<PracticeSession> sessions) {
        AiPaperDTO dto = new AiPaperDTO();
        dto.setPaperId(paper.getId());
        dto.setName(paper.getName());
        dto.setSubjectName(paper.getSubjectName());
        PaperCate category = PaperCate.fromCode(paper.getPaperCateId());
        dto.setCategory(category == null ? "未知" : category.getDescription());
        dto.setYear(paper.getPaperYear());
        dto.setMonth(paper.getPaperMonth());
        int questionCount = paper.getQuestionTotal() == null ? 0 : paper.getQuestionTotal();
        dto.setQuestionCount(questionCount);

        Comparator<PracticeSession> activityComparator = Comparator
                .comparing(this::activityTime, Comparator.nullsFirst(Date::compareTo))
                .thenComparing(PracticeSession::getId, Comparator.nullsFirst(Integer::compareTo));
        PracticeSession ongoing = sessions.stream()
                .filter(session -> Integer.valueOf(PracticeSessionState.DOING.getCode())
                        .equals(session.getStatus()))
                .max(activityComparator)
                .orElse(null);
        boolean completed = sessions.stream()
                .anyMatch(session -> Integer.valueOf(PracticeSessionState.FINISHED.getCode())
                        .equals(session.getStatus()));
        Date lastActivity = sessions.stream()
                .map(this::activityTime)
                .filter(java.util.Objects::nonNull)
                .max(Date::compareTo)
                .orElse(null);
        dto.setLastPracticeTime(lastActivity == null ? null : lastActivity.toInstant());
        if (ongoing != null) {
            dto.setPracticeStatus(PaperStatus.IN_PROGRESS);
            dto.setOngoingSessionId(ongoing.getId());
            int answered = ongoing.getAnsweredCount() == null ? 0 : ongoing.getAnsweredCount();
            dto.setCompletedQuestionCount(Math.min(questionCount, Math.max(0, answered)));
        } else if (completed) {
            dto.setPracticeStatus(PaperStatus.COMPLETED);
            dto.setCompletedQuestionCount(questionCount);
        } else {
            dto.setPracticeStatus(PaperStatus.NOT_STARTED);
            dto.setCompletedQuestionCount(0);
        }
        return dto;
    }

    private Date activityTime(PracticeSession session) {
        if (session.getUpdateTime() != null) {
            return session.getUpdateTime();
        }
        if (session.getEndTime() != null) {
            return session.getEndTime();
        }
        return session.getCreateTime();
    }

    private List<AiQuestionOptionDTO> parseOptions(String rawOptions) {
        if (StrUtil.isBlank(rawOptions)) {
            return new ArrayList<>();
        }
        List<Option> options = JSONUtil.toList(rawOptions, Option.class);
        return options.stream()
                .sorted(Comparator.comparing(Option::getOrderNum,
                        Comparator.nullsLast(Integer::compareTo)))
                .map(option -> new AiQuestionOptionDTO(option.getKeyStr(), option.getValueStr()))
                .collect(Collectors.toList());
    }

    private String mapQuestionType(Integer type) {
        if (type == null) {
            return "unknown";
        }
        switch (type) {
            case 1: return "single_choice";
            case 2: return "multiple_choice";
            case 3: return "judgement";
            case 4: return "fill_blank";
            case 5: return "case_analysis";
            case 6: return "essay";
            default: return "unknown";
        }
    }

    private String mapDifficulty(Integer difficulty) {
        if (difficulty == null) {
            return "unknown";
        }
        switch (difficulty) {
            case 1: return "easy";
            case 2: return "medium";
            case 3: return "hard";
            default: return "unknown";
        }
    }
}
