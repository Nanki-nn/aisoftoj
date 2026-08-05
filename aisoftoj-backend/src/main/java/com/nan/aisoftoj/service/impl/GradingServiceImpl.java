package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.common.UnprocessableEntityException;
import com.nan.aisoftoj.consts.GradingStrategy;
import com.nan.aisoftoj.dto.GradingResult;
import com.nan.aisoftoj.service.GradingService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class GradingServiceImpl implements GradingService {

    @Override
    public void validateUserAnswer(String userAnswer) {
        if (userAnswer == null) {
            return;
        }
        int codePointCount = userAnswer.codePointCount(0, userAnswer.length());
        if (codePointCount > MAX_ANSWER_CODE_POINTS) {
            throw new UnprocessableEntityException("单题答案不能超过 10000 个 Unicode 字符");
        }
    }

    @Override
    public GradingResult grade(
            GradingStrategy strategy,
            String standardAnswer,
            String userAnswer,
            BigDecimal scoreSnapshot) {
        Objects.requireNonNull(strategy, "判分策略不能为空");
        Objects.requireNonNull(scoreSnapshot, "题目分值快照不能为空");
        if (scoreSnapshot.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("题目分值快照不能为负数");
        }
        validateUserAnswer(userAnswer);

        if (strategy == GradingStrategy.MANUAL) {
            return new GradingResult(false, null, BigDecimal.ZERO, BigDecimal.ZERO);
        }

        boolean correct;
        switch (strategy) {
            case EXACT_CHOICE:
                correct = exactChoiceMatches(standardAnswer, userAnswer);
                break;
            case SET_CHOICE:
                correct = setChoiceMatches(standardAnswer, userAnswer);
                break;
            case ORDERED_BLANKS:
                correct = orderedBlanksMatch(standardAnswer, userAnswer);
                break;
            default:
                throw new IllegalArgumentException("不支持的判分策略: " + strategy);
        }

        return new GradingResult(
                true,
                correct,
                correct ? scoreSnapshot : BigDecimal.ZERO,
                scoreSnapshot);
    }

    private boolean exactChoiceMatches(String standardAnswer, String userAnswer) {
        if (!hasText(standardAnswer) || !hasText(userAnswer)) {
            return false;
        }
        return normalizeChoice(standardAnswer).equals(normalizeChoice(userAnswer));
    }

    private boolean setChoiceMatches(String standardAnswer, String userAnswer) {
        if (!hasText(standardAnswer) || !hasText(userAnswer)) {
            return false;
        }
        return normalizeChoiceSet(standardAnswer).equals(normalizeChoiceSet(userAnswer));
    }

    private boolean orderedBlanksMatch(String standardAnswer, String userAnswer) {
        if (!hasText(standardAnswer) || !hasText(userAnswer)) {
            return false;
        }
        return normalizeOrderedBlanks(standardAnswer).equals(normalizeOrderedBlanks(userAnswer));
    }

    private String normalizeChoice(String value) {
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private List<String> normalizeChoiceSet(String value) {
        return Arrays.stream(value.split(",", -1))
                .map(this::normalizeChoice)
                .filter(item -> !item.isEmpty())
                .distinct()
                .sorted()
                .collect(Collectors.toList());
    }

    private List<String> normalizeOrderedBlanks(String value) {
        return Arrays.stream(value.split("\\|\\|", -1))
                .map(String::trim)
                .map(item -> Normalizer.normalize(item, Normalizer.Form.NFKC))
                .collect(Collectors.toList());
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
