package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.dto.UpdateQuestionRecordDTO;
import com.nan.aisoftoj.entity.PracticeSessionQuestionRecord;
import com.nan.aisoftoj.mapper.PracticeSessionQuestionRecordMapper;
import com.nan.aisoftoj.service.PracticeSessionQuestionRecordService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class  PracticeSessionQuestionRecordServiceImpl implements PracticeSessionQuestionRecordService {

    @Autowired
    private PracticeSessionQuestionRecordMapper practiceSessionQuestionRecordMapper;


    @Override
    public Long updatePracticeSessionQuestionRecord(Integer questionRecordId, UpdateQuestionRecordDTO updateQuestionRecordDTO) {


        // 检查题目记录是否存在
        PracticeSessionQuestionRecord practiceSessionQuestionRecord = practiceSessionQuestionRecordMapper.selectById(questionRecordId);
        if (practiceSessionQuestionRecord == null) {
            throw new IllegalArgumentException("题目记录不存在");
        }

        PracticeSessionQuestionRecord updatePracticeSessionQuestionRecord = new PracticeSessionQuestionRecord();
        updatePracticeSessionQuestionRecord.setId(questionRecordId);
        updatePracticeSessionQuestionRecord.setUserAnswer(updateQuestionRecordDTO.getUserAnswer());
        practiceSessionQuestionRecordMapper.updateById(updatePracticeSessionQuestionRecord);


        return Long.valueOf(practiceSessionQuestionRecord.getId());
    }


}
