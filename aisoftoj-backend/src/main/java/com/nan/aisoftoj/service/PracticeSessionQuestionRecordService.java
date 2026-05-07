package com.nan.aisoftoj.service;
import com.nan.aisoftoj.dto.QuestionRecordRequest;
import com.nan.aisoftoj.dto.UpdateQuestionRecordDTO;

import java.util.List;

public interface PracticeSessionQuestionRecordService {

    Long updatePracticeSessionQuestionRecord(Integer userId, Integer questionRecordId, UpdateQuestionRecordDTO updateQuestionRecordDTO);

}
