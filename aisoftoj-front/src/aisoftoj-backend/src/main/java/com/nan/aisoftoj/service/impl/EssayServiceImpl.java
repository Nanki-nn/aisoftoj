package com.nan.aisoftoj.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
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
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
public class EssayServiceImpl implements EssayService {

    @Autowired
    private EssaySubmissionMapper essaySubmissionMapper;

    @Autowired
    private EssayReviewMapper essayReviewMapper;

    @Autowired
    private QuestionMapper questionMapper;

    @Autowired
    private RestTemplate restTemplate;

    @Value("${claude.api-key}")
    private String claudeApiKey;

    @Value("${claude.model}")
    private String claudeModel;

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

    @Async
    @Override
    public void gradeAsync(Long submissionId) {
        EssaySubmission submission = essaySubmissionMapper.selectById(submissionId);
        if (submission == null) return;

        try {
            // Fetch the question text
            String questionText = "";
            if (submission.getQuestionId() != null) {
                Question question = questionMapper.selectById(submission.getQuestionId());
                if (question != null && question.getIntro() != null) {
                    questionText = question.getIntro();
                }
            }

            // Truncate content to 3000 chars to control token cost
            String content = submission.getContent();
            if (content != null && content.length() > 3000) {
                content = content.substring(0, 3000) + "...（已截断）";
            }
            String abstractText = submission.getAbstractText() != null ? submission.getAbstractText() : "";

            // Build prompt
            String userPrompt = buildGradingPrompt(questionText, abstractText, content);

            // Call Anthropic API
            String responseJson = callClaudeApi(userPrompt);

            // Parse response
            JsonNode root = objectMapper.readTree(responseJson);
            // The response content is in root["content"][0]["text"]
            String textContent = root.path("content").get(0).path("text").asText();

            // Extract JSON from the text (Claude might wrap it in markdown code blocks)
            String jsonStr = extractJson(textContent);
            JsonNode scores = objectMapper.readTree(jsonStr);

            // Build and save EssayReview
            EssayReview review = new EssayReview();
            review.setSubmissionId(submissionId);
            review.setScoreAbstract(new BigDecimal(scores.path("score_abstract").asText("0")));
            review.setScoreStructure(new BigDecimal(scores.path("score_structure").asText("0")));
            review.setScoreRelevance(new BigDecimal(scores.path("score_relevance").asText("0")));
            review.setScoreDepth(new BigDecimal(scores.path("score_depth").asText("0")));
            review.setScoreEvidence(new BigDecimal(scores.path("score_evidence").asText("0")));
            review.setScoreLanguage(new BigDecimal(scores.path("score_language").asText("0")));
            review.setTotalScore(new BigDecimal(scores.path("total_score").asText("0")));

            // suggestions is a JSON array
            JsonNode suggestionsNode = scores.path("suggestions");
            review.setSuggestions(objectMapper.writeValueAsString(suggestionsNode));
            review.setRawResponse(textContent);

            essayReviewMapper.insert(review);

            // Update submission status
            submission.setStatus(1);
            submission.setTotalScore(review.getTotalScore());
            essaySubmissionMapper.updateById(submission);

        } catch (Exception e) {
            log.error("Essay grading failed for submission {}: {}", submissionId, e.getMessage(), e);
            // Mark as failed
            EssaySubmission failed = new EssaySubmission();
            failed.setId(submissionId);
            failed.setStatus(2);
            essaySubmissionMapper.updateById(failed);
        }
    }

    private String buildGradingPrompt(String questionText, String abstractText, String content) {
        return "你是一位专业的软考论文阅卷专家。请对以下软考论文进行评分。\n\n" +
               "## 评分标准（总分25分）\n" +
               "- 摘要质量（4分）：摘要是否概括全文、字数合规（280-320字）、表述清晰\n" +
               "- 结构完整性（4分）：引言/正文/结尾层次是否分明\n" +
               "- 主题相关性（5分）：论点是否紧扣题目要求\n" +
               "- 技术深度（6分）：软件工程核心概念的覆盖与运用是否到位\n" +
               "- 论据充实度（3分）：是否有案例、数据、实际经验支撑\n" +
               "- 语言流畅度（3分）：表达是否规范、逻辑连贯、无明显语病\n\n" +
               "## 论文题目\n" + (questionText.isEmpty() ? "（未提供）" : questionText) + "\n\n" +
               "## 考生摘要\n" + (abstractText.isEmpty() ? "（未提供摘要）" : abstractText) + "\n\n" +
               "## 考生正文\n" + content + "\n\n" +
               "请严格按照以下JSON格式返回评分结果，不要包含任何其他文字：\n" +
               "{\n" +
               "  \"score_abstract\": 3.5,\n" +
               "  \"score_structure\": 3.0,\n" +
               "  \"score_relevance\": 4.0,\n" +
               "  \"score_depth\": 4.5,\n" +
               "  \"score_evidence\": 2.5,\n" +
               "  \"score_language\": 2.5,\n" +
               "  \"total_score\": 20.0,\n" +
               "  \"suggestions\": [\n" +
               "    \"具体改进建议1（不超过50字）\",\n" +
               "    \"具体改进建议2（不超过50字）\",\n" +
               "    \"具体改进建议3（不超过50字）\"\n" +
               "  ]\n" +
               "}";
    }

    private String callClaudeApi(String userPrompt) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", claudeApiKey);
        headers.set("anthropic-version", "2023-06-01");

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", claudeModel);
        requestBody.put("max_tokens", 1024);

        Map<String, String> message = new HashMap<>();
        message.put("role", "user");
        message.put("content", userPrompt);
        requestBody.put("messages", Collections.singletonList(message));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(
                "https://api.anthropic.com/v1/messages", entity, String.class);

        return response.getBody();
    }

    private String extractJson(String text) {
        // Handle case where Claude wraps JSON in ```json ... ``` blocks
        if (text.contains("```json")) {
            int start = text.indexOf("```json") + 7;
            int end = text.lastIndexOf("```");
            if (end > start) return text.substring(start, end).trim();
        }
        if (text.contains("```")) {
            int start = text.indexOf("```") + 3;
            int end = text.lastIndexOf("```");
            if (end > start) return text.substring(start, end).trim();
        }
        // Otherwise find the JSON object directly
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start >= 0 && end > start) return text.substring(start, end + 1);
        return text;
    }
}
