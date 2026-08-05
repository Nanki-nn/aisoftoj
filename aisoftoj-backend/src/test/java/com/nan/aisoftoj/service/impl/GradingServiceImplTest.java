package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.common.UnprocessableEntityException;
import com.nan.aisoftoj.consts.GradingStrategy;
import com.nan.aisoftoj.dto.GradingResult;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GradingServiceImplTest {

    private final GradingServiceImpl service = new GradingServiceImpl();

    @Test
    void exactChoiceTrimsAndNormalizesOptionCase() {
        GradingResult result = service.grade(
                GradingStrategy.EXACT_CHOICE,
                " A ",
                "a",
                new BigDecimal("2.50"));

        assertTrue(result.isGradable());
        assertEquals(true, result.getIsCorrect());
        assertEquals(new BigDecimal("2.50"), result.getAwardedScore());
        assertEquals(new BigDecimal("2.50"), result.getGradableScore());
    }

    @Test
    void setChoiceIgnoresOrderDuplicatesWhitespaceAndOptionCase() {
        GradingResult result = service.grade(
                GradingStrategy.SET_CHOICE,
                "A, B, C",
                " c, a, B, a ",
                BigDecimal.ONE);

        assertEquals(true, result.getIsCorrect());
        assertEquals(BigDecimal.ONE, result.getAwardedScore());
    }

    @Test
    void orderedBlanksPreserveOrderAfterTrimAndUnicodeNfkcNormalization() {
        GradingResult correct = service.grade(
                GradingStrategy.ORDERED_BLANKS,
                "ＡＢＣ || ４２",
                "ABC||42",
                new BigDecimal("5.00"));
        GradingResult reversed = service.grade(
                GradingStrategy.ORDERED_BLANKS,
                "ＡＢＣ || ４２",
                "42||ABC",
                new BigDecimal("5.00"));

        assertEquals(true, correct.getIsCorrect());
        assertEquals(false, reversed.getIsCorrect());
        assertEquals(BigDecimal.ZERO, reversed.getAwardedScore());
        assertEquals(new BigDecimal("5.00"), reversed.getGradableScore());
    }

    @Test
    void manualAnswersRemainUngradedAndOutOfTheAutomaticDenominator() {
        GradingResult result = service.grade(
                GradingStrategy.MANUAL,
                "参考答案",
                "学生答案",
                new BigDecimal("15.00"));

        assertFalse(result.isGradable());
        assertNull(result.getIsCorrect());
        assertEquals(BigDecimal.ZERO, result.getAwardedScore());
        assertEquals(BigDecimal.ZERO, result.getGradableScore());
    }

    @Test
    void answerLengthCountsUnicodeCodePointsInsteadOfUtf16Units() {
        service.validateUserAnswer(repeatCodePoint(0x1F600, 10_000));

        assertThrows(
                UnprocessableEntityException.class,
                () -> service.validateUserAnswer(repeatCodePoint(0x1F600, 10_001)));
    }

    private String repeatCodePoint(int codePoint, int count) {
        StringBuilder builder = new StringBuilder(count * 2);
        for (int i = 0; i < count; i++) {
            builder.appendCodePoint(codePoint);
        }
        return builder.toString();
    }
}
