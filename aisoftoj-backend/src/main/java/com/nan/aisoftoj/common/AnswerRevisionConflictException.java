package com.nan.aisoftoj.common;

import com.nan.aisoftoj.dto.QuestionRecordUpdateResponse;

public class AnswerRevisionConflictException extends ConflictException {

    private final QuestionRecordUpdateResponse currentState;

    public AnswerRevisionConflictException(String message, QuestionRecordUpdateResponse currentState) {
        super(message);
        this.currentState = currentState;
    }

    public QuestionRecordUpdateResponse getCurrentState() {
        return currentState;
    }
}
