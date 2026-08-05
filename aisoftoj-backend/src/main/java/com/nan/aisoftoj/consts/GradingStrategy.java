package com.nan.aisoftoj.consts;

public enum GradingStrategy {
    EXACT_CHOICE,
    SET_CHOICE,
    ORDERED_BLANKS,
    MANUAL;

    public static GradingStrategy fromQuestionType(Integer questionType) {
        if (questionType == null) {
            throw new IllegalArgumentException("题型不能为空");
        }
        switch (questionType) {
            case 1:
            case 3:
                return EXACT_CHOICE;
            case 2:
                return SET_CHOICE;
            case 4:
                return ORDERED_BLANKS;
            case 5:
            case 6:
                return MANUAL;
            default:
                throw new IllegalArgumentException("不支持的题型: " + questionType);
        }
    }
}
