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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class EssayServiceImpl implements EssayService {

    private static final Logger log = LoggerFactory.getLogger(EssayServiceImpl.class);

    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
    private static final int CONTENT_MAX_LENGTH = 3000;

    @Value("${claude.api-key:}")
    private String apiKey;

    @Value("${claude.model:claude-sonnet-4-6}")
    private String claudeModel;

    // 通过代理自注入，确保 @Async 通过 Spring AOP 代理生效（避免自调用绕过代理的问题）
    @Autowired
    @Lazy
    private EssayService self;

    @Autowired
    private EssaySubmissionMapper essaySubmissionMapper;

    @Autowired
    private EssayReviewMapper essayReviewMapper;

    @Autowired
    private QuestionMapper questionMapper;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

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

        // 通过代理调用，确保 @Async 生效
        self.gradeAsync(submission.getId());

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
        EssaySubmission submission = essaySubmissionMapper.selectById(submissionId);
        if (submission == null) {
            log.warn("gradeAsync: submission {} not found", submissionId);
            return;
        }

        // 获取题目正文
        String questionText = "";
        if (submission.getQuestionId() != null) {
            Question question = questionMapper.selectById(submission.getQuestionId());
            if (question != null && question.getIntro() != null) {
                questionText = question.getIntro();
            }
        }

        // 正文截断至 3000 字，控制 Token 成本
        String content = submission.getContent();
        if (content != null && content.length() > CONTENT_MAX_LENGTH) {
            content = content.substring(0, CONTENT_MAX_LENGTH);
        }

        String rawResponse = null;
        try {
            String prompt = buildPrompt(questionText, submission.getAbstractText(), content);
            rawResponse = callClaudeApi(prompt);

            String jsonStr = extractJson(rawResponse);
            Map<String, Object> result = objectMapper.readValue(jsonStr, new TypeReference<Map<String, Object>>() {});

            EssayReview review = new EssayReview();
            review.setSubmissionId(submissionId);
            review.setScoreAbstract(toBigDecimal(result.get("score_abstract")));
            review.setScoreStructure(toBigDecimal(result.get("score_structure")));
            review.setScoreRelevance(toBigDecimal(result.get("score_relevance")));
            review.setScoreDepth(toBigDecimal(result.get("score_depth")));
            review.setScoreEvidence(toBigDecimal(result.get("score_evidence")));
            review.setScoreLanguage(toBigDecimal(result.get("score_language")));
            review.setTotalScore(toBigDecimal(result.get("total_score")));
            review.setSuggestions(objectMapper.writeValueAsString(result.get("suggestions")));
            review.setRawResponse(rawResponse);
            review.setCreateTime(LocalDateTime.now());
            review.setUpdateTime(LocalDateTime.now());
            review.setIsDeleted(0);
            essayReviewMapper.insert(review);

            submission.setStatus(1);
            submission.setTotalScore(review.getTotalScore());
            submission.setUpdateTime(LocalDateTime.now());
            essaySubmissionMapper.updateById(submission);

            log.info("gradeAsync: submission {} graded successfully, score={}", submissionId, review.getTotalScore());

        } catch (Exception e) {
            log.error("gradeAsync: submission {} failed: {}", submissionId, e.getMessage(), e);
            submission.setStatus(2);
            submission.setUpdateTime(LocalDateTime.now());
            essaySubmissionMapper.updateById(submission);
        }
    }

    /**
     * 构建发送给 Claude 的评分 Prompt
     */
    private String buildPrompt(String questionText, String abstractText, String content) {
        return "你是一位资深的软件水平考试（软考）论文阅卷专家，请严格按照软考高级职称论文评分标准对以下论文进行评分。\n\n" +
                "## 评分维度与满分\n" +
                "- 摘要质量（score_abstract）：满分5分，评估摘要是否准确反映论文核心内容\n" +
                "- 结构完整性（score_structure）：满分5分，评估论文结构是否层次清晰、逻辑严谨\n" +
                "- 主题相关性（score_relevance）：满分5分，评估论文内容是否紧扣题目要求\n" +
                "- 技术深度（score_depth）：满分4分，评估技术分析是否深入、是否体现高级职称水平\n" +
                "- 论据充实度（score_evidence）：满分3分，评估是否有具体案例、数据或实践支撑\n" +
                "- 语言流畅度（score_language）：满分3分，评估语言表达是否规范、流畅\n" +
                "- 总分（total_score）：各维度分数之和，满分25分\n\n" +
                "## 论文题目\n" + questionText + "\n\n" +
                "## 考生摘要\n" + (abstractText != null ? abstractText : "（未填写）") + "\n\n" +
                "## 考生正文\n" + (content != null ? content : "（未填写）") + "\n\n" +
                "## 输出要求\n" +
                "请严格返回如下 JSON 格式，不要包含任何额外文字、Markdown 代码块或注释：\n" +
                "{\n" +
                "  \"score_abstract\": <0-5的数字>,\n" +
                "  \"score_structure\": <0-5的数字>,\n" +
                "  \"score_relevance\": <0-5的数字>,\n" +
                "  \"score_depth\": <0-4的数字>,\n" +
                "  \"score_evidence\": <0-3的数字>,\n" +
                "  \"score_language\": <0-3的数字>,\n" +
                "  \"total_score\": <各维度之和>,\n" +
                "  \"suggestions\": [\"改进建议1\", \"改进建议2\", \"改进建议3\"]\n" +
                "}";
    }

    /**
     * 调用 Anthropic Messages API，返回 Claude 的文本回复
     */
    @SuppressWarnings("unchecked")
    private String callClaudeApi(String prompt) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> message = new HashMap<>();
        message.put("role", "user");
        message.put("content", prompt);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", claudeModel);
        requestBody.put("max_tokens", 1024);
        requestBody.put("messages", new Object[]{message});

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(CLAUDE_API_URL, entity, Map.class);

        Map<String, Object> body = response.getBody();
        if (body == null) {
            throw new RuntimeException("Claude API 返回空响应");
        }
        List<Map<String, Object>> contentList = (List<Map<String, Object>>) body.get("content");
        if (contentList == null || contentList.isEmpty()) {
            throw new RuntimeException("Claude API 响应中无 content 字段");
        }
        return (String) contentList.get(0).get("text");
    }

    /**
     * 从 Claude 回复文本中提取 JSON 字符串（兼容 markdown 代码块包裹的情况）
     */
    private String extractJson(String text) {
        if (text == null) throw new RuntimeException("Claude 返回文本为空");
        // 尝试匹配 ```json ... ``` 或 ``` ... ```
        Pattern codeBlock = Pattern.compile("```(?:json)?\\s*([\\s\\S]*?)```");
        Matcher matcher = codeBlock.matcher(text);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        // 尝试直接提取第一个 { ... }
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }
        return text.trim();
    }

    /**
     * 将 JSON 解析出的数值安全转换为 BigDecimal
     */
    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }
}
