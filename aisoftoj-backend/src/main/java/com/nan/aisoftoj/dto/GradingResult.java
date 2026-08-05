package com.nan.aisoftoj.dto;

import java.math.BigDecimal;

public class GradingResult {
    private final boolean gradable;
    private final Boolean isCorrect;
    private final BigDecimal awardedScore;
    private final BigDecimal gradableScore;

    public GradingResult(
            boolean gradable,
            Boolean isCorrect,
            BigDecimal awardedScore,
            BigDecimal gradableScore) {
        this.gradable = gradable;
        this.isCorrect = isCorrect;
        this.awardedScore = awardedScore;
        this.gradableScore = gradableScore;
    }

    public boolean isGradable() {
        return gradable;
    }

    public Boolean getIsCorrect() {
        return isCorrect;
    }

    public BigDecimal getAwardedScore() {
        return awardedScore;
    }

    public BigDecimal getGradableScore() {
        return gradableScore;
    }
}
