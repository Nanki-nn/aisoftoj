package com.nan.aisoftoj.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nan.aisoftoj.common.AnswerRevisionConflictException;
import com.nan.aisoftoj.common.ConflictException;
import com.nan.aisoftoj.common.ForbiddenException;
import com.nan.aisoftoj.consts.GradingStrategy;
import com.nan.aisoftoj.consts.PracticeSessionState;
import com.nan.aisoftoj.dto.GradingResult;
import com.nan.aisoftoj.dto.QuestionRecordUpdateResponse;
import com.nan.aisoftoj.dto.UpdateQuestionRecordDTO;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.entity.PracticeSessionQuestionRecord;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.PracticeSessionQuestionRecordMapper;
import com.nan.aisoftoj.service.GradingService;
import com.nan.aisoftoj.service.PracticeSessionQuestionRecordService;
import com.nan.aisoftoj.service.QuestionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Date;
import java.util.Objects;

@Service
public class PracticeSessionQuestionRecordServiceImpl implements PracticeSessionQuestionRecordService {

    @Autowired
    private PracticeSessionQuestionRecordMapper practiceSessionQuestionRecordMapper;

    @Autowired
    private PracticeSessionMapper practiceSessionMapper;

    @Autowired
    private QuestionService questionService;

    @Autowired
    private GradingService gradingService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public QuestionRecordUpdateResponse updatePracticeSessionQuestionRecord(
            Integer userId,
            Integer questionRecordId,
            UpdateQuestionRecordDTO request) {
        PracticeSessionQuestionRecord initialRecord = practiceSessionQuestionRecordMapper.selectById(questionRecordId);
        if (initialRecord == null || Boolean.TRUE.equals(initialRecord.getIsDeleted())) {
            throw new IllegalArgumentException("题目记录不存在");
        }

        PracticeSession session = practiceSessionMapper.selectByIdForUpdate(initialRecord.getSessionId());
        if (session == null || session.getIsDeleted() != null && session.getIsDeleted() == 1) {
            throw new ForbiddenException("无权修改该题目记录");
        }
        if (!userId.equals(session.getUserId())) {
            throw new ForbiddenException("无权修改该题目记录");
        }
        if (session.getStatus() == null || session.getStatus() != PracticeSessionState.DOING.getCode()) {
            throw new ConflictException("已结束的刷题会话不能修改答题记录");
        }

        PracticeSessionQuestionRecord lockedRecord = practiceSessionQuestionRecordMapper
                .selectByIdForUpdate(questionRecordId);
        if (lockedRecord == null || !initialRecord.getSessionId().equals(lockedRecord.getSessionId())) {
            throw new ConflictException("题目记录状态已变化，请刷新后重试");
        }
        Long currentRevision = lockedRecord.getAnswerRevision() == null ? 0L : lockedRecord.getAnswerRevision();
        if (Objects.equals(request.getMutationId(), lockedRecord.getLastMutationId())) {
            return toResponse(lockedRecord);
        }
        if (lockedRecord.getConfirmedAt() != null) {
            throw new ConflictException("已确认的题目不能再次修改");
        }
        if (!Objects.equals(request.getExpectedRevision(), currentRevision)) {
            throw revisionConflict(lockedRecord);
        }

        String userAnswer = request.getUserAnswer() == null ? "" : request.getUserAnswer();
        gradingService.validateUserAnswer(userAnswer);
        int spendTime = request.getSpendTime() == null ? 0 : request.getSpendTime();
        boolean confirm = Boolean.TRUE.equals(request.getConfirm());
        int updated;
        if (confirm) {
            if (!"practice".equalsIgnoreCase(session.getExamMode())) {
                throw new ConflictException("考试模式不支持单题确认");
            }
            updated = confirmRecord(
                    lockedRecord,
                    userAnswer,
                    spendTime,
                    currentRevision,
                    request.getMutationId());
        } else {
            updated = practiceSessionQuestionRecordMapper.updateDraftWithRevision(
                    questionRecordId,
                    userAnswer,
                    spendTime,
                    currentRevision,
                    request.getMutationId());
        }
        if (updated != 1) {
            PracticeSessionQuestionRecord currentRecord = practiceSessionQuestionRecordMapper
                    .selectByIdForUpdate(questionRecordId);
            throw revisionConflict(currentRecord == null ? lockedRecord : currentRecord);
        }

        lockedRecord.setUserAnswer(userAnswer);
        lockedRecord.setSpendTime(spendTime);
        lockedRecord.setAnswerRevision(currentRevision + 1);
        lockedRecord.setLastMutationId(request.getMutationId());
        if (!confirm) {
            lockedRecord.setIsSubmitted(false);
            lockedRecord.setIsCorrect(null);
        }

        Long answeredCount = practiceSessionQuestionRecordMapper.selectCount(
                new LambdaQueryWrapper<PracticeSessionQuestionRecord>()
                        .eq(PracticeSessionQuestionRecord::getSessionId, lockedRecord.getSessionId())
                        .eq(PracticeSessionQuestionRecord::getIsDeleted, false)
                        .isNotNull(PracticeSessionQuestionRecord::getUserAnswer)
                        .ne(PracticeSessionQuestionRecord::getUserAnswer, ""));
        PracticeSession sessionUpdate = new PracticeSession();
        sessionUpdate.setId(lockedRecord.getSessionId());
        sessionUpdate.setAnsweredCount(answeredCount.intValue());
        practiceSessionMapper.updateById(sessionUpdate);

        return toResponse(lockedRecord);
    }

    private int confirmRecord(
            PracticeSessionQuestionRecord record,
            String userAnswer,
            int spendTime,
            Long currentRevision,
            String mutationId) {
        Question question = questionService.getById(record.getQuestionId());
        if (question == null) {
            throw new ConflictException("题目不可用，暂时无法确认");
        }
        GradingStrategy strategy = record.getGradingStrategySnapshot() == null
                ? GradingStrategy.fromQuestionType(question.getQuestionType())
                : GradingStrategy.valueOf(record.getGradingStrategySnapshot());
        BigDecimal scoreSnapshot = record.getScoreSnapshot() == null
                ? BigDecimal.ONE
                : record.getScoreSnapshot();
        GradingResult gradingResult = gradingService.grade(
                strategy,
                question.getAnswer(),
                userAnswer,
                scoreSnapshot);
        Date confirmedAt = new Date((System.currentTimeMillis() / 1000L) * 1000L);
        int updated = practiceSessionQuestionRecordMapper.confirmWithRevision(
                record.getId(),
                userAnswer,
                spendTime,
                currentRevision,
                mutationId,
                gradingResult.getIsCorrect(),
                confirmedAt);
        if (updated == 1) {
            record.setIsSubmitted(true);
            record.setIsCorrect(gradingResult.getIsCorrect());
            record.setConfirmedAt(confirmedAt);
        }
        return updated;
    }

    private AnswerRevisionConflictException revisionConflict(PracticeSessionQuestionRecord record) {
        return new AnswerRevisionConflictException("答案版本冲突，请基于服务器最新版本重试", toResponse(record));
    }

    private QuestionRecordUpdateResponse toResponse(PracticeSessionQuestionRecord record) {
        QuestionRecordUpdateResponse response = new QuestionRecordUpdateResponse();
        response.setRecordId(record.getId());
        response.setUserAnswer(record.getUserAnswer());
        response.setSpendTime(record.getSpendTime());
        response.setAnswerRevision(record.getAnswerRevision() == null ? 0L : record.getAnswerRevision());
        response.setMutationId(record.getLastMutationId());
        response.setIsSubmitted(record.getIsSubmitted());
        response.setIsCorrect(record.getIsCorrect());
        response.setConfirmedAt(record.getConfirmedAt());
        return response;
    }
}
