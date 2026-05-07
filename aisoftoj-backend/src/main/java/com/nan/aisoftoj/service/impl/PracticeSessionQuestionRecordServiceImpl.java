package com.nan.aisoftoj.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nan.aisoftoj.common.ForbiddenException;
import com.nan.aisoftoj.dto.UpdateQuestionRecordDTO;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.entity.PracticeSessionQuestionRecord;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.PracticeSessionQuestionRecordMapper;
import com.nan.aisoftoj.service.QuestionService;
import com.nan.aisoftoj.service.PracticeSessionQuestionRecordService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class  PracticeSessionQuestionRecordServiceImpl implements PracticeSessionQuestionRecordService {

    @Autowired
    private PracticeSessionQuestionRecordMapper practiceSessionQuestionRecordMapper;

    @Autowired
    private PracticeSessionMapper practiceSessionMapper;

    @Autowired
    private QuestionService questionService;


    @Override
    public Long updatePracticeSessionQuestionRecord(Integer userId, Integer questionRecordId, UpdateQuestionRecordDTO updateQuestionRecordDTO) {
        // 检查题目记录是否存在
        PracticeSessionQuestionRecord practiceSessionQuestionRecord = practiceSessionQuestionRecordMapper.selectById(questionRecordId);
        if (practiceSessionQuestionRecord == null) {
            throw new IllegalArgumentException("题目记录不存在");
        }

        PracticeSession practiceSession = practiceSessionMapper.selectOne(new LambdaQueryWrapper<PracticeSession>()
                .eq(PracticeSession::getId, practiceSessionQuestionRecord.getSessionId())
                .eq(PracticeSession::getUserId, userId)
                .eq(PracticeSession::getIsDeleted, 0)
                .last("LIMIT 1"));
        if (practiceSession == null) {
            throw new ForbiddenException("无权修改该题目记录");
        }

        PracticeSessionQuestionRecord updatePracticeSessionQuestionRecord = new PracticeSessionQuestionRecord();
        updatePracticeSessionQuestionRecord.setId(questionRecordId);
        updatePracticeSessionQuestionRecord.setUserAnswer(updateQuestionRecordDTO.getUserAnswer());
        updatePracticeSessionQuestionRecord.setIsSubmitted(updateQuestionRecordDTO.getUserAnswer() != null && !updateQuestionRecordDTO.getUserAnswer().trim().isEmpty());
        updatePracticeSessionQuestionRecord.setSpendTime(updateQuestionRecordDTO.getSpendTime() == null ? 0 : updateQuestionRecordDTO.getSpendTime());
        Question question = questionService.getById(practiceSessionQuestionRecord.getQuestionId());
        if (question != null) {
            updatePracticeSessionQuestionRecord.setIsCorrect(isCorrectAnswer(question.getAnswer(), updateQuestionRecordDTO.getUserAnswer()));
        }
        practiceSessionQuestionRecordMapper.updateById(updatePracticeSessionQuestionRecord);

        Long answeredCount = practiceSessionQuestionRecordMapper.selectCount(new LambdaQueryWrapper<PracticeSessionQuestionRecord>()
                .eq(PracticeSessionQuestionRecord::getSessionId, practiceSessionQuestionRecord.getSessionId())
                .eq(PracticeSessionQuestionRecord::getIsDeleted, false)
                .isNotNull(PracticeSessionQuestionRecord::getUserAnswer)
                .ne(PracticeSessionQuestionRecord::getUserAnswer, ""));
        PracticeSession updateSession = new PracticeSession();
        updateSession.setId(practiceSessionQuestionRecord.getSessionId());
        updateSession.setAnsweredCount(answeredCount.intValue());
        practiceSessionMapper.updateById(updateSession);


        return Long.valueOf(practiceSessionQuestionRecord.getId());
    }

    private boolean isCorrectAnswer(String standardAnswer, String userAnswer) {
        if (standardAnswer == null || standardAnswer.trim().isEmpty()) {
            return false;
        }
        if (userAnswer == null || userAnswer.trim().isEmpty()) {
            return false;
        }

        String normalizedStandard = standardAnswer.trim();
        String normalizedUser = userAnswer.trim();
        if (!normalizedStandard.contains(",")) {
            return normalizedStandard.equalsIgnoreCase(normalizedUser);
        }

        java.util.List<String> standardAnswers = java.util.Arrays.stream(normalizedStandard.split(","))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .sorted()
                .collect(java.util.stream.Collectors.toList());
        java.util.List<String> userAnswers = java.util.Arrays.stream(normalizedUser.split(","))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .sorted()
                .collect(java.util.stream.Collectors.toList());
        return standardAnswers.equals(userAnswers);
    }


}
