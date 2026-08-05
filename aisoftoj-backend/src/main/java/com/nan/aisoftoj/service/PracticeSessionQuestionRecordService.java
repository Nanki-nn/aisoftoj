package com.nan.aisoftoj.service;

import com.nan.aisoftoj.dto.QuestionRecordUpdateResponse;
import com.nan.aisoftoj.dto.UpdateQuestionRecordDTO;

public interface PracticeSessionQuestionRecordService {

    QuestionRecordUpdateResponse updatePracticeSessionQuestionRecord(
            Integer userId,
            Integer questionRecordId,
            UpdateQuestionRecordDTO updateQuestionRecordDTO);
}
