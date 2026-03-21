package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.dto.UpdateQuestionRecordDTO;
import com.nan.aisoftoj.service.PracticeSessionQuestionRecordService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;


/**
 * 会话题目状态
 */

@RestController
public class PracticeSessionQuestionRecordController {

    @Autowired
    private PracticeSessionQuestionRecordService  practiceSessionQuestionRecordService;


    /**
     * 变更题目记录表
     * URI: /practice/session/question/record/{questionRecordId}
     * Method: PATCH
     */
    @PatchMapping("/practice/session/question/record/{questionRecordId}")
    public ResultDTO<Long> updatePracticeSessionQuestionRecord(@PathVariable Integer questionRecordId, @RequestBody UpdateQuestionRecordDTO updateQuestionRecordDTO) {
        Long result = practiceSessionQuestionRecordService.updatePracticeSessionQuestionRecord(questionRecordId, updateQuestionRecordDTO);
        return ResultDTO.success(result);
    }




}
