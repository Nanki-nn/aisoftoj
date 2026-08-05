package com.nan.aisoftoj.service;

import com.nan.aisoftoj.consts.GradingStrategy;
import com.nan.aisoftoj.dto.GradingResult;

import java.math.BigDecimal;

public interface GradingService {

    int MAX_ANSWER_CODE_POINTS = 10_000;

    void validateUserAnswer(String userAnswer);

    GradingResult grade(
            GradingStrategy strategy,
            String standardAnswer,
            String userAnswer,
            BigDecimal scoreSnapshot);
}
