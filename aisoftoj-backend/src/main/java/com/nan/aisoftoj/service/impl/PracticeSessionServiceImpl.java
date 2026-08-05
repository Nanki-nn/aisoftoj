package com.nan.aisoftoj.service.impl;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nan.aisoftoj.common.ConflictException;
import com.nan.aisoftoj.common.ForbiddenException;
import com.nan.aisoftoj.common.ResourceNotFoundException;
import com.nan.aisoftoj.consts.GradingStrategy;
import com.nan.aisoftoj.consts.PracticeSessionState;
import com.nan.aisoftoj.dto.*;
import com.nan.aisoftoj.entity.Paper;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.entity.PracticeSessionQuestionRecord;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.entity.UserWrongQuestionStat;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.PracticeSessionQuestionRecordMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import com.nan.aisoftoj.service.GradingService;
import com.nan.aisoftoj.service.PaperService;
import com.nan.aisoftoj.service.PracticeSessionService;
import com.nan.aisoftoj.service.QuestionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class PracticeSessionServiceImpl implements PracticeSessionService {

    private static final long PAUSED_END_TIME_CUTOFF_MILLIS = 946684800000L;

    @Autowired
    private PaperService paperService;
    @Autowired
    private QuestionService questionService;
	@Autowired
	private PracticeSessionMapper practiceSessionMapper;
    @Autowired
    private PracticeSessionQuestionRecordMapper practiceSessionQuestionRecordMapper;
    @Autowired
    private UserWrongQuestionStatMapper userWrongQuestionStatMapper;
    @Autowired
    private GradingService gradingService;


    @Override
    @Transactional(rollbackFor = Exception.class)
    public StartPracticeSessionRes startPracticeSession(Integer userId, StartPracticeSessionReq startPracticeSessionReq) {

        // 从请求中获取试卷ID
        Integer paperId =  startPracticeSessionReq.getPaperId();
        String sessionMode = startPracticeSessionReq.getMode() != null && startPracticeSessionReq.getMode() == 2
                ? "exam"
                : "practice";

        //校验paperId是否存在
        Paper paper = paperService.getById(paperId);
        if (paper == null
                || Boolean.TRUE.equals(paper.getIsDeleted())
                || !Boolean.TRUE.equals(paper.getPublishStatus())) {
            throw new ResourceNotFoundException("试卷不存在或暂未发布");
        }

        //检查用户是否已创建该试卷的会话记录
        PracticeSession practiceSession = findActiveSession(userId, paperId, sessionMode);
        if (practiceSession != null) {
           // 如果存在未完成的记录，返回该记录ID
			resumeSessionIfPaused(practiceSession);
			return getStatPracticeSessionRes(practiceSession, paperId, paper);
        }

        List<SessionQuestionSnapshot> questionSnapshots =
                questionService.listSessionQuestionSnapshotsByPaperId(paperId);
        if (questionSnapshots.isEmpty()) {
            throw new IllegalArgumentException("试卷不存在题目");
        }

        //创建试卷会话记录
        PracticeSession insertPracticeSession = new PracticeSession();
        insertPracticeSession.setPaperId(paperId);
        insertPracticeSession.setUserId(userId);
        insertPracticeSession.setStartTime(new Date());
        insertPracticeSession.setExamMode(sessionMode);
        insertPracticeSession.setAnsweredCount(0);
        insertPracticeSession.setStatus(PracticeSessionState.DOING.getCode());
        insertPracticeSession.setTotalScore(calculateGradableTotalScore(questionSnapshots));
        // 插入记录到数据库
        try {
            practiceSessionMapper.insert(insertPracticeSession);
        } catch (DuplicateKeyException duplicateKeyException) {
            PracticeSession winningSession = findActiveSession(userId, paperId, sessionMode);
            if (winningSession == null) {
                throw duplicateKeyException;
            }
            resumeSessionIfPaused(winningSession);
            return getStatPracticeSessionRes(winningSession, paperId, paper);
        }


        //初始化会话题目记录PracticeSessionQuestionRecord
        initPracticeSessionQuestionRecord(questionSnapshots, insertPracticeSession.getId());

        // 返回新创建的会话记录
		return getStatPracticeSessionRes(insertPracticeSession, paperId, paper);
    }

    private PracticeSession findActiveSession(Integer userId, Integer paperId, String sessionMode) {
        return practiceSessionMapper.selectOne(
                new LambdaQueryWrapper<PracticeSession>()
                        .eq(PracticeSession::getPaperId, paperId)
                        .eq(PracticeSession::getUserId, userId)
                        .eq(PracticeSession::getExamMode, sessionMode)
                        .eq(PracticeSession::getStatus, PracticeSessionState.DOING.getCode())
                        .eq(PracticeSession::getIsDeleted, 0)
                        .last("LIMIT 1")
        );
    }


    private StartPracticeSessionRes getStatPracticeSessionRes(PracticeSession practiceSession, Integer paperId, Paper paper) {
        StartPracticeSessionRes res = new StartPracticeSessionRes();
        res.setPracticeSessionId(practiceSession.getId());
        res.setPaperId(paperId);
        res.setPaperName(paper.getName());
        res.setStatus(practiceSession.getStatus());
        res.setStartTime(practiceSession.getStartTime());
        res.setPaper(paper);
        res.setQuestionList(getSessionQuestionDTOs(practiceSession, false));
        return res;
    }



    private List<QuestionDTO> getSessionQuestionDTOs(
            PracticeSession practiceSession,
            boolean includeCompletedReview) {
        List<SessionQuestionSnapshot> snapshots =
                questionService.listSessionQuestionSnapshotsBySessionId(practiceSession.getId());
        List<QuestionDTO> questionDTOs = new ArrayList<>();
        for (SessionQuestionSnapshot snapshot : snapshots) {
            QuestionDTO questionDTO = new QuestionDTO();
            questionDTO.setId(snapshot.getQuestionId());
            questionDTO.setName(snapshot.getName());
            questionDTO.setIntro(snapshot.getIntro());
            questionDTO.setOptions(parseOptions(snapshot.getOptions()));
            questionDTO.setQuestionType(snapshot.getQuestionType());
            questionDTO.setDifficulty(snapshot.getDifficulty());
            questionDTO.setQuestionRecordId(snapshot.getQuestionRecordId());
            questionDTO.setUserAnswer(snapshot.getUserAnswer());
            questionDTO.setIsSubmitted(snapshot.getIsSubmitted());
            questionDTO.setSpendTime(snapshot.getSpendTime());
            questionDTO.setAnswerRevision(snapshot.getAnswerRevision());
            questionDTO.setQuestionOrder(snapshot.getQuestionOrder());
            questionDTO.setScoreSnapshot(snapshot.getScoreSnapshot());
            questionDTO.setGradingStrategySnapshot(snapshot.getGradingStrategySnapshot());
            questionDTO.setConfirmedAt(snapshot.getConfirmedAt());
            if (canRevealAnswer(practiceSession, snapshot, includeCompletedReview)) {
                questionDTO.setAnswer(snapshot.getAnswer());
                questionDTO.setAnalysis(snapshot.getAnalysis());
                questionDTO.setIsCorrect(snapshot.getIsCorrect());
            }
            questionDTOs.add(questionDTO);
        }
        return questionDTOs;
    }

    private boolean canRevealAnswer(
            PracticeSession practiceSession,
            SessionQuestionSnapshot snapshot,
            boolean includeCompletedReview) {
        if (includeCompletedReview
                && practiceSession.getStatus() != null
                && practiceSession.getStatus() == PracticeSessionState.FINISHED.getCode()) {
            return true;
        }
        return isDoing(practiceSession)
                && "practice".equals(practiceSession.getExamMode())
                && snapshot.getConfirmedAt() != null;
    }

    private List<Option> parseOptions(String rawOptions) {
        if (rawOptions == null || rawOptions.trim().isEmpty()) {
            return new ArrayList<>();
        }
        if (!JSONUtil.isTypeJSONArray(rawOptions)) {
            return new ArrayList<>();
        }

        try {
            List<Option> optionList = JSONUtil.toList(rawOptions, Option.class);
            if (!optionList.isEmpty() && optionList.get(0).getValueStr() != null) {
                return optionList;
            }
        } catch (Exception ignored) {
        }

        List<String> values = JSONUtil.toList(rawOptions, String.class);
        List<Option> options = new ArrayList<>();
        for (int i = 0; i < values.size(); i++) {
            Option option = new Option();
            option.setKeyStr(String.valueOf((char) ('A' + i)));
            option.setValueStr(values.get(i));
            option.setOrderNum(i + 1);
            options.add(option);
        }
        return options;
    }


    private void initPracticeSessionQuestionRecord(
            List<SessionQuestionSnapshot> questionSnapshots,
            Integer practiceSessionId) {
        for (SessionQuestionSnapshot snapshot : questionSnapshots) {
            PracticeSessionQuestionRecord practiceSessionQuestionRecord = new PracticeSessionQuestionRecord();
            practiceSessionQuestionRecord.setSessionId(practiceSessionId);
            practiceSessionQuestionRecord.setQuestionId(snapshot.getQuestionId());
            practiceSessionQuestionRecord.setPaperQuestionRelationId(snapshot.getPaperQuestionRelationId());
            practiceSessionQuestionRecord.setQuestionOrder(snapshot.getQuestionOrder());
            practiceSessionQuestionRecord.setScoreSnapshot(snapshot.getScoreSnapshot());
            practiceSessionQuestionRecord.setGradingStrategySnapshot(snapshot.getGradingStrategySnapshot());
            practiceSessionQuestionRecordMapper.insert(practiceSessionQuestionRecord);
        }
    }

    private BigDecimal calculateGradableTotalScore(List<SessionQuestionSnapshot> snapshots) {
        return snapshots.stream()
                .filter(snapshot -> !GradingStrategy.MANUAL.name().equals(snapshot.getGradingStrategySnapshot()))
                .map(SessionQuestionSnapshot::getScoreSnapshot)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public GETPracticeSessionRes getPracticeSessionDetail(Integer userId, Integer practiceSessionId) {
        //校验practiceSessionId是否存在
        PracticeSession practiceSession = getOwnedSession(userId, practiceSessionId);
        if (practiceSession == null) {
            throw new IllegalArgumentException("试卷会话记录不存在");
        }
        resumeSessionIfPaused(practiceSession);
        //获取试卷信息
        Paper paper = paperService.getById(practiceSession.getPaperId());
        if (paper == null) {
            throw new IllegalArgumentException("试卷不存在");
        }


        return buildSessionResponse(practiceSession, paper, false);

    }

    @Override
    public GETPracticeSessionRes getPracticeSessionResult(Integer userId, Integer practiceSessionId) {
        PracticeSession practiceSession = getOwnedSession(userId, practiceSessionId);
        if (practiceSession == null) {
            throw new IllegalArgumentException("试卷会话记录不存在");
        }
        if (practiceSession.getStatus() == null
                || practiceSession.getStatus() != PracticeSessionState.FINISHED.getCode()) {
            throw new ConflictException("会话尚未完成，不能查看完整复盘");
        }
        Paper paper = paperService.getById(practiceSession.getPaperId());
        if (paper == null) {
            throw new IllegalArgumentException("试卷不存在");
        }

        return buildSessionResponse(practiceSession, paper, true);
    }

    private GETPracticeSessionRes buildSessionResponse(
            PracticeSession practiceSession,
            Paper paper,
            boolean includeCompletedReview) {
        GETPracticeSessionRes result = new GETPracticeSessionRes();
        result.setId(practiceSession.getId());
        result.setUserId(practiceSession.getUserId());
        result.setPaperId(practiceSession.getPaperId());
        result.setExamMode(practiceSession.getExamMode());
        result.setStatus(practiceSession.getStatus());
        result.setStartTime(practiceSession.getStartTime());
        result.setEndTime(practiceSession.getEndTime());
        result.setPaperName(paper.getName());
        result.setPaper(paper);
        result.setQuestionList(getSessionQuestionDTOs(practiceSession, includeCompletedReview));
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void pausePracticeSession(Integer userId, Integer practiceSessionId) {
        PracticeSession practiceSession = getOwnedSession(userId, practiceSessionId);
        if (practiceSession == null) {
            throw new IllegalArgumentException("试卷会话记录不存在");
        }
        if (!isDoing(practiceSession) || isPaused(practiceSession)) {
            return;
        }

        Date pausedAt = new Date();
        PracticeSession updateSession = new PracticeSession();
        updateSession.setId(practiceSessionId);
        updateSession.setEndTime(pausedAt);
        practiceSessionMapper.updateById(updateSession);
        practiceSession.setEndTime(pausedAt);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PaperSubmitResponse submitPracticeSession(Integer userId, Integer practiceSessionId, PaperSubmitRequest request) {
        PracticeSession practiceSession = getOwnedSessionForUpdate(userId, practiceSessionId);
        if (practiceSession == null) {
            throw new IllegalArgumentException("试卷会话记录不存在");
        }
        if (practiceSession.getStatus() != null
                && practiceSession.getStatus() == PracticeSessionState.FINISHED.getCode()) {
            return buildPersistedSubmitResponse(practiceSession);
        }
        if (!isDoing(practiceSession)) {
            throw new ConflictException("当前刷题会话不能交卷");
        }
        boolean shouldRecordWrongStats = practiceSession.getStatus() == null
                || practiceSession.getStatus() != PracticeSessionState.FINISHED.getCode();

        List<PracticeSessionQuestionRecord> records =
                practiceSessionQuestionRecordMapper.selectBySessionIdOrdered(practiceSessionId);
        if (records.isEmpty()) {
            throw new IllegalArgumentException("试卷会话不存在题目快照");
        }
        Paper paper = paperService.getById(practiceSession.getPaperId());

        Map<Integer, SessionQuestionSnapshot> questionMap = questionService
                .listSessionQuestionSnapshotsBySessionId(practiceSessionId)
                .stream()
                .collect(Collectors.toMap(
                        SessionQuestionSnapshot::getQuestionId,
                        snapshot -> snapshot,
                        (left, right) -> left));
        Map<Integer, PaperSubmitRequest.QuestionAnswer> answerMap = new HashMap<>();
        if (request != null && request.getAnswers() != null) {
            for (PaperSubmitRequest.QuestionAnswer answer : request.getAnswers()) {
                if (answer.getQuestionId() != null) {
                    answerMap.put(answer.getQuestionId(), answer);
                }
            }
        }

        BigDecimal score = BigDecimal.ZERO;
        BigDecimal totalScore = BigDecimal.ZERO;
        int answeredCount = 0;

        for (PracticeSessionQuestionRecord record : records) {
            SessionQuestionSnapshot question = questionMap.get(record.getQuestionId());
            if (question == null) {
                throw new ConflictException("会话题目快照已失效");
            }

            PaperSubmitRequest.QuestionAnswer submitAnswer = answerMap.get(record.getQuestionId());
            String userAnswer = submitAnswer == null ? record.getUserAnswer() : submitAnswer.getUserAnswer();
            String gradingStrategyName = record.getGradingStrategySnapshot() == null
                    ? GradingStrategy.fromQuestionType(question.getQuestionType()).name()
                    : record.getGradingStrategySnapshot();
            BigDecimal questionScore = record.getScoreSnapshot() == null
                    ? BigDecimal.ONE
                    : record.getScoreSnapshot();
            GradingResult gradingResult = gradingService.grade(
                    GradingStrategy.valueOf(gradingStrategyName),
                    question.getAnswer(),
                    userAnswer,
                    questionScore);
            Boolean isCorrect = gradingResult.getIsCorrect();
            totalScore = totalScore.add(gradingResult.getGradableScore());
            if (userAnswer != null && !userAnswer.trim().isEmpty()) {
                answeredCount++;
            }

            PracticeSessionQuestionRecord updateRecord = new PracticeSessionQuestionRecord();
            updateRecord.setId(record.getId());
            updateRecord.setUserAnswer(userAnswer);
            updateRecord.setIsSubmitted(userAnswer != null && !userAnswer.trim().isEmpty());
            updateRecord.setIsCorrect(isCorrect);
            updateRecord.setSpendTime(submitAnswer == null ? record.getSpendTime() : submitAnswer.getSpendTime());
            practiceSessionQuestionRecordMapper.updateById(updateRecord);

            score = score.add(gradingResult.getAwardedScore());
            if (Boolean.FALSE.equals(isCorrect) && shouldRecordWrongStats) {
                saveWrongQuestionStat(
                        userId,
                        practiceSession.getPaperId(),
                        practiceSessionId,
                        paper,
                        toQuestion(question));
            }
        }

        PracticeSession updateSession = new PracticeSession();
        updateSession.setId(practiceSessionId);
        updateSession.setStatus(PracticeSessionState.FINISHED.getCode());
        updateSession.setAnsweredCount(answeredCount);
        updateSession.setEndTime(request != null && request.getEndTime() != null ? request.getEndTime() : new Date());
        updateSession.setScore(score);
        updateSession.setTotalScore(totalScore);
        practiceSessionMapper.updateById(updateSession);

        PaperSubmitResponse response = new PaperSubmitResponse();
        response.setRecordId(Long.valueOf(practiceSessionId));
        response.setScore(score);
        response.setTotalScore(totalScore);
        response.setStatus(PracticeSessionState.FINISHED.getCode());
        return response;
    }

    private Question toQuestion(SessionQuestionSnapshot snapshot) {
        Question question = new Question();
        question.setId(snapshot.getQuestionId());
        question.setName(snapshot.getName());
        question.setQuestionType(snapshot.getQuestionType());
        return question;
    }

    private PaperSubmitResponse buildPersistedSubmitResponse(PracticeSession practiceSession) {
        PaperSubmitResponse response = new PaperSubmitResponse();
        response.setRecordId(Long.valueOf(practiceSession.getId()));
        response.setScore(practiceSession.getScore());
        response.setTotalScore(practiceSession.getTotalScore());
        response.setStatus(PracticeSessionState.FINISHED.getCode());
        return response;
    }

    private void saveWrongQuestionStat(
            Integer userId,
            Integer paperId,
            Integer sessionId,
            Paper paper,
            Question question) {
        Date now = new Date();
        String sourceFrontId = "session_wrong_" + userId + "_" + question.getId();
        UserWrongQuestionStat stat = new UserWrongQuestionStat();
        stat.setSourceFrontId(sourceFrontId);
        stat.setSourceType("wrong_question");
        stat.setUserId(userId);
        stat.setPaperId(paperId);
        stat.setQuestionId(question.getId());
        stat.setQuestionName(question.getName());
        stat.setPaperName(paper == null ? null : paper.getName());
        stat.setTopicType(getQuestionTypeName(question.getQuestionType()));
        stat.setErrorCount(1);
        stat.setImportanceLevel("medium");
        stat.setLastWrongTime(now);
        stat.setLastSessionId(sessionId);
        stat.setIsDeleted(0);
        userWrongQuestionStatMapper.upsertActiveWrongQuestion(stat);
    }

    private String getQuestionTypeName(Integer questionType) {
        if (questionType == null) {
            return "未知题型";
        }
        switch (questionType) {
            case 1:
                return "单选题";
            case 2:
                return "多选题";
            case 3:
                return "判断题";
            case 4:
                return "填空题";
            case 5:
                return "案例题";
            case 6:
                return "论文题";
            default:
                return "未知题型";
        }
    }

    private PracticeSession getOwnedSession(Integer userId, Integer practiceSessionId) {
        return validateOwnedSession(userId, practiceSessionMapper.selectById(practiceSessionId));
    }

    private PracticeSession getOwnedSessionForUpdate(Integer userId, Integer practiceSessionId) {
        return validateOwnedSession(userId, practiceSessionMapper.selectByIdForUpdate(practiceSessionId));
    }

    private PracticeSession validateOwnedSession(Integer userId, PracticeSession practiceSession) {
        if (practiceSession == null || practiceSession.getIsDeleted() != null && practiceSession.getIsDeleted() == 1) {
            return null;
        }
        if (!userId.equals(practiceSession.getUserId())) {
            throw new ForbiddenException("无权访问该试卷会话");
        }
        return practiceSession;
    }

    private void resumeSessionIfPaused(PracticeSession practiceSession) {
        if (!isDoing(practiceSession) || !isPaused(practiceSession)) {
            return;
        }

        Date resumedAt = new Date();
        Date pausedAt = practiceSession.getEndTime();
        Date startTime = practiceSession.getStartTime();
        long pausedMillis = Math.max(0L, resumedAt.getTime() - pausedAt.getTime());
        Date adjustedStartTime = startTime == null
                ? resumedAt
                : new Date(startTime.getTime() + pausedMillis);
        Date activeEndTime = new Date(0L);

        PracticeSession updateSession = new PracticeSession();
        updateSession.setId(practiceSession.getId());
        updateSession.setStartTime(adjustedStartTime);
        updateSession.setEndTime(activeEndTime);
        practiceSessionMapper.updateById(updateSession);

        practiceSession.setStartTime(adjustedStartTime);
        practiceSession.setEndTime(activeEndTime);
    }

    private boolean isDoing(PracticeSession practiceSession) {
        return practiceSession.getStatus() != null
                && practiceSession.getStatus() == PracticeSessionState.DOING.getCode();
    }

    private boolean isPaused(PracticeSession practiceSession) {
        return practiceSession.getEndTime() != null
                && practiceSession.getEndTime().getTime() >= PAUSED_END_TIME_CUTOFF_MILLIS;
    }

}
