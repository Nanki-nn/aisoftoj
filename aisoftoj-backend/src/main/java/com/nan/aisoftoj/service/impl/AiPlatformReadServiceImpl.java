package com.nan.aisoftoj.service.impl;

import cn.hutool.json.JSONUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.nan.aisoftoj.common.ResourceNotFoundException;
import com.nan.aisoftoj.common.ConflictException;
import com.nan.aisoftoj.common.UserRole;
import com.nan.aisoftoj.consts.PaperCate;
import com.nan.aisoftoj.consts.PaperStatus;
import com.nan.aisoftoj.consts.PracticeSessionState;
import com.nan.aisoftoj.dto.Option;
import com.nan.aisoftoj.dto.ai.AiPaperDTO;
import com.nan.aisoftoj.dto.ai.AiProfileDTO;
import com.nan.aisoftoj.dto.ai.AiQuestionDTO;
import com.nan.aisoftoj.dto.ai.AiQuestionOptionDTO;
import com.nan.aisoftoj.dto.ai.AiPracticeHistoryItemDTO;
import com.nan.aisoftoj.dto.ai.AiPracticeHistoryPageDTO;
import com.nan.aisoftoj.dto.ai.AiPracticeHistorySummaryDTO;
import com.nan.aisoftoj.dto.ai.AiWrongQuestionReviewDTO;
import com.nan.aisoftoj.dto.PracticeHistorySummaryDTO;
import com.nan.aisoftoj.entity.Paper;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.entity.PracticeSessionQuestionRecord;
import com.nan.aisoftoj.entity.UserWrongQuestionStat;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.mapper.PaperMapper;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.QuestionMapper;
import com.nan.aisoftoj.mapper.PracticeSessionQuestionRecordMapper;
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
    private final PracticeSessionQuestionRecordMapper questionRecordMapper;

    public AiPlatformReadServiceImpl(
            UserMapper userMapper,
            PracticeSessionMapper practiceSessionMapper,
            UserWrongQuestionStatMapper wrongQuestionStatMapper,
            PaperMapper paperMapper,
            QuestionMapper questionMapper,
            PracticeSessionQuestionRecordMapper questionRecordMapper) {
        this.userMapper = userMapper;
        this.practiceSessionMapper = practiceSessionMapper;
        this.wrongQuestionStatMapper = wrongQuestionStatMapper;
        this.paperMapper = paperMapper;
        this.questionMapper = questionMapper;
        this.questionRecordMapper = questionRecordMapper;
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

    @Override
    public AiWrongQuestionReviewDTO reviewWrongQuestion(Integer userId, Long wrongQuestionId) {
        if (wrongQuestionId == null || wrongQuestionId <= 0) {
            throw new IllegalArgumentException("wrongQuestionId 必须为正整数");
        }
        UserWrongQuestionStat wrong = wrongQuestionStatMapper.selectById(wrongQuestionId);
        if (wrong == null
                || !userId.equals(wrong.getUserId())
                || !Integer.valueOf(0).equals(wrong.getIsDeleted())) {
            throw new ResourceNotFoundException("错题记录不存在");
        }
        if (wrong.getLastSessionId() == null || wrong.getPaperId() == null
                || wrong.getQuestionId() == null) {
            throw new ConflictException("错题关联信息不完整");
        }
        PracticeSession session = practiceSessionMapper.selectById(wrong.getLastSessionId());
        if (session == null
                || !userId.equals(session.getUserId())
                || !Integer.valueOf(0).equals(session.getIsDeleted())
                || !Integer.valueOf(PracticeSessionState.FINISHED.getCode()).equals(session.getStatus())
                || !wrong.getPaperId().equals(session.getPaperId())) {
            throw new ConflictException("错题关联的练习会话状态不一致");
        }
        PracticeSessionQuestionRecord record = questionRecordMapper.selectOne(
                Wrappers.lambdaQuery(PracticeSessionQuestionRecord.class)
                        .eq(PracticeSessionQuestionRecord::getSessionId, session.getId())
                        .eq(PracticeSessionQuestionRecord::getQuestionId, wrong.getQuestionId())
                        .eq(PracticeSessionQuestionRecord::getIsDeleted, false)
                        .last("LIMIT 1"));
        Question question = questionMapper.selectById(wrong.getQuestionId());
        if (record == null || question == null || !Integer.valueOf(0).equals(question.getIsDeleted())) {
            throw new ConflictException("错题关联的题目记录状态不一致");
        }
        if (StrUtil.isBlank(question.getAnswer())) {
            throw new ConflictException("错题标准答案不可用");
        }

        AiWrongQuestionReviewDTO dto = new AiWrongQuestionReviewDTO();
        dto.setWrongQuestionId(wrong.getId());
        dto.setQuestionId(question.getId());
        dto.setPaperId(wrong.getPaperId());
        dto.setPaperName(wrong.getPaperName());
        dto.setQuestionName(question.getName());
        dto.setQuestionContent(question.getIntro());
        dto.setOptions(parseOptions(question.getOptions()));
        dto.setQuestionType(mapQuestionType(question.getQuestionType()));
        dto.setDifficulty(mapDifficulty(question.getDifficulty()));
        dto.setUserAnswer(StrUtil.nullToEmpty(record.getUserAnswer()));
        dto.setCorrectAnswer(question.getAnswer());
        dto.setAnalysis(question.getAnalysis());
        dto.setErrorCount(wrong.getErrorCount());
        dto.setImportance(wrong.getImportanceLevel());
        dto.setLastWrongTime(
                wrong.getLastWrongTime() == null ? null : wrong.getLastWrongTime().toInstant());
        dto.setSpendTime(record.getSpendTime());
        return dto;
    }

    @Override
    public AiPracticeHistoryPageDTO listPracticeHistory(
            Integer userId, Integer page, Integer pageSize) {
        if (page == null || page < 1 || pageSize == null || pageSize < 1 || pageSize > 20) {
            throw new IllegalArgumentException("page 必须大于等于 1，pageSize 必须在 1 到 20 之间");
        }
        int offset = (page - 1) * pageSize;
        List<PracticeSession> sessions = practiceSessionMapper.selectList(
                Wrappers.lambdaQuery(PracticeSession.class)
                        .eq(PracticeSession::getUserId, userId)
                        .eq(PracticeSession::getIsDeleted, false)
                        .in(PracticeSession::getStatus,
                                PracticeSessionState.DOING.getCode(),
                                PracticeSessionState.FINISHED.getCode())
                        .orderByDesc(PracticeSession::getCreateTime)
                        .orderByDesc(PracticeSession::getId)
                        .last("LIMIT " + pageSize + " OFFSET " + offset));
        List<AiPracticeHistoryItemDTO> records = sessions.stream()
                .map(this::toHistoryItem)
                .collect(Collectors.toList());
        PracticeHistorySummaryDTO sourceSummary =
                practiceSessionMapper.selectPracticeHistorySummaryByUserId(userId);
        AiPracticeHistorySummaryDTO summary = toHistorySummary(sourceSummary);
        AiPracticeHistoryPageDTO result = new AiPracticeHistoryPageDTO();
        result.setRecords(records);
        result.setTotal(summary.getTotalCount());
        result.setPage(page);
        result.setPageSize(pageSize);
        result.setSummary(summary);
        return result;
    }

    private AiPracticeHistoryItemDTO toHistoryItem(PracticeSession session) {
        Paper paper = paperMapper.selectById(session.getPaperId());
        if (paper == null || Boolean.TRUE.equals(paper.getIsDeleted())) {
            throw new IllegalStateException("练习历史关联的试卷不存在");
        }
        AiPracticeHistoryItemDTO dto = new AiPracticeHistoryItemDTO();
        dto.setSessionId(session.getId());
        dto.setPaperName(paper.getName());
        dto.setExamMode(session.getExamMode());
        PaperCate category = PaperCate.fromCode(paper.getPaperCateId());
        dto.setExamType(category == null ? "综合知识" : category.getDescription());
        dto.setCreatedAt(session.getCreateTime() == null ? null : session.getCreateTime().toInstant());
        dto.setAnsweredCount(session.getAnsweredCount() == null ? 0 : session.getAnsweredCount());
        dto.setQuestionCount(paper.getQuestionTotal() == null ? 0 : paper.getQuestionTotal());
        dto.setStatus(Integer.valueOf(PracticeSessionState.FINISHED.getCode())
                .equals(session.getStatus()) ? "completed" : "in_progress");
        return dto;
    }

    private AiPracticeHistorySummaryDTO toHistorySummary(PracticeHistorySummaryDTO source) {
        AiPracticeHistorySummaryDTO dto = new AiPracticeHistorySummaryDTO();
        dto.setTotalCount(source == null || source.getTotalCount() == null ? 0L : source.getTotalCount());
        dto.setInProgressCount(source == null || source.getInProgressCount() == null
                ? 0L : source.getInProgressCount());
        dto.setCompletedCount(source == null || source.getCompletedCount() == null
                ? 0L : source.getCompletedCount());
        dto.setAnsweredCount(source == null || source.getAnsweredCount() == null
                ? 0L : source.getAnsweredCount());
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
