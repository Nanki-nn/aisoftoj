package com.nan.aisoftoj.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nan.aisoftoj.dto.EssayHistoryItem;
import com.nan.aisoftoj.dto.EssayResultResponse;
import com.nan.aisoftoj.dto.EssaySubmitRequest;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.entity.EssayReview;
import com.nan.aisoftoj.entity.EssaySubmission;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.mapper.EssayReviewMapper;
import com.nan.aisoftoj.mapper.EssaySubmissionMapper;
import com.nan.aisoftoj.mapper.QuestionMapper;
import com.nan.aisoftoj.service.EssayService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class EssayServiceImpl implements EssayService {

    @Autowired
    private EssaySubmissionMapper essaySubmissionMapper;

    @Autowired
    private EssayReviewMapper essayReviewMapper;

    @Autowired
    private QuestionMapper questionMapper;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public ResultDTO<?> submitEssay(EssaySubmitRequest req, Long userId) {
        // 检查每日配额
        int todayCount = essaySubmissionMapper.countTodayByUser(userId);
        if (todayCount >= 3) {
            return ResultDTO.error(429, "今日批改次数已用完");
        }

        // 计算字数
        int wordCount = 0;
        if (req.getContent() != null) {
            wordCount = req.getContent().trim().length();
        }

        // 保存提交记录
        EssaySubmission submission = new EssaySubmission();
        submission.setUserId(userId);
        submission.setQuestionId(req.getQuestionId());
        submission.setAbstractText(req.getAbstractText());
        submission.setContent(req.getContent());
        submission.setWordCount(wordCount);
        submission.setStatus(0);
        submission.setCreateTime(LocalDateTime.now());
        submission.setUpdateTime(LocalDateTime.now());
        submission.setIsDeleted(0);
        essaySubmissionMapper.insert(submission);

        // 触发异步批改
        gradeAsync(submission.getId());

        Map<String, Object> data = new HashMap<>();
        data.put("submissionId", submission.getId());
        return ResultDTO.success(data);
    }

    @Override
    public ResultDTO<EssayResultResponse> getResult(Long submissionId, Long userId) {
        // 查询提交记录
        EssaySubmission submission = essaySubmissionMapper.selectOne(
                new LambdaQueryWrapper<EssaySubmission>()
                        .eq(EssaySubmission::getId, submissionId)
                        .eq(EssaySubmission::getUserId, userId)
                        .eq(EssaySubmission::getIsDeleted, 0)
        );
        if (submission == null) {
            return ResultDTO.notFound("提交记录不存在");
        }

        EssayResultResponse response = new EssayResultResponse();
        response.setSubmissionId(submission.getId());
        response.setStatus(submission.getStatus());
        response.setTotalScore(submission.getTotalScore());

        // 查询批改记录
        EssayReview review = essayReviewMapper.selectOne(
                new LambdaQueryWrapper<EssayReview>()
                        .eq(EssayReview::getSubmissionId, submissionId)
                        .eq(EssayReview::getIsDeleted, 0)
                        .last("LIMIT 1")
        );
        if (review != null) {
            response.setScoreAbstract(review.getScoreAbstract());
            response.setScoreStructure(review.getScoreStructure());
            response.setScoreRelevance(review.getScoreRelevance());
            response.setScoreDepth(review.getScoreDepth());
            response.setScoreEvidence(review.getScoreEvidence());
            response.setScoreLanguage(review.getScoreLanguage());
            response.setTotalScore(review.getTotalScore());

            // 解析 suggestions JSON 字符串为 List<String>
            List<String> suggestions = new ArrayList<>();
            if (review.getSuggestions() != null && !review.getSuggestions().trim().isEmpty()) {
                try {
                    suggestions = objectMapper.readValue(review.getSuggestions(),
                            new TypeReference<List<String>>() {});
                } catch (Exception e) {
                    suggestions = new ArrayList<>();
                }
            }
            response.setSuggestions(suggestions);
        }

        return ResultDTO.success(response);
    }

    @Override
    public ResultDTO<List<EssayHistoryItem>> getHistory(Long userId) {
        List<EssaySubmission> submissions = essaySubmissionMapper.selectList(
                new LambdaQueryWrapper<EssaySubmission>()
                        .eq(EssaySubmission::getUserId, userId)
                        .eq(EssaySubmission::getIsDeleted, 0)
                        .orderByDesc(EssaySubmission::getCreateTime)
        );

        List<EssayHistoryItem> historyItems = submissions.stream().map(submission -> {
            EssayHistoryItem item = new EssayHistoryItem();
            item.setSubmissionId(submission.getId());
            item.setQuestionId(submission.getQuestionId());
            item.setWordCount(submission.getWordCount());
            item.setTotalScore(submission.getTotalScore());
            item.setStatus(submission.getStatus());
            item.setCreateTime(submission.getCreateTime());

            // 查询题目标题
            if (submission.getQuestionId() != null) {
                Question question = questionMapper.selectById(submission.getQuestionId());
                if (question != null) {
                    String intro = question.getIntro();
                    if (intro != null && intro.length() > 100) {
                        intro = intro.substring(0, 100);
                    }
                    item.setQuestionTitle(intro);
                }
            }
            return item;
        }).collect(Collectors.toList());

        return ResultDTO.success(historyItems);
    }

    @Override
    public ResultDTO<List<Map<String, Object>>> getQuestions(String subject) {
        LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<Question>()
                .eq(Question::getQuestionType, 6)
                .eq(Question::getIsDeleted, 0);

        List<Question> questions = questionMapper.selectList(wrapper);

        List<Map<String, Object>> result = questions.stream().map(question -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", question.getId());
            String intro = question.getIntro();
            if (intro != null && intro.length() > 100) {
                intro = intro.substring(0, 100);
            }
            item.put("intro", intro);
            return item;
        }).collect(Collectors.toList());

        return ResultDTO.success(result);
    }

    @Override
    @Async
    public void gradeAsync(Long submissionId) {
        // TODO: implement in Issue #4
    }
}
