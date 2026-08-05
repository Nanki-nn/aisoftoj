package com.nan.aisoftoj.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.nan.aisoftoj.common.ResourceNotFoundException;
import com.nan.aisoftoj.crypto.ContentCryptoPayloadTooLargeException;
import com.nan.aisoftoj.dto.GetQuestionDetailDTO;
import com.nan.aisoftoj.dto.QuestionRecordRequest;
import com.nan.aisoftoj.dto.SessionQuestionSnapshot;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.mapper.QuestionMapper;
import com.nan.aisoftoj.service.QuestionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class QuestionServiceImpl implements QuestionService {

    private static final int MAX_QUESTIONS_PER_PAPER = 200;
    
    @Autowired
    private QuestionMapper questionMapper;


    @Override
    public List<Question> getQuestionsByPaperId(Integer paperId) {
        // 这里应该查询试卷关联的题目列表


        return enforceQuestionCount(questionMapper.selectQuestionsByPaperId(paperId));
    }

    @Override
    public GetQuestionDetailDTO getQuestionById(Integer questionId, Boolean withAnswer) {
        Question question = questionMapper.selectById(questionId);
        if (question == null
                || question.getIsDeleted() == null
                || question.getIsDeleted() != 0
                || questionMapper.countPublishedPaperRelations(questionId) == 0) {
            throw new ResourceNotFoundException("题目不存在或暂未发布");
        }
        // 如果不包含答案，则清空答案字段
        if (!Boolean.TRUE.equals(withAnswer)) {
            question.setAnswer(null);
        }

        GetQuestionDetailDTO questionDetailDTO = new GetQuestionDetailDTO();
        questionDetailDTO.setId(question.getId());
        questionDetailDTO.setName(question.getName());
        questionDetailDTO.setIntro(question.getIntro());
        questionDetailDTO.setAnalysis(question.getAnalysis());
        questionDetailDTO.setQuestionType(question.getQuestionType());
        questionDetailDTO.setDifficulty(question.getDifficulty());
        questionDetailDTO.setReadCt(question.getReadCt());
        questionDetailDTO.setAnswer(question.getAnswer());
        return questionDetailDTO;
    }

    @Override
    public boolean updateQuestionRecord(QuestionRecordRequest request) {
        // 这里应该更新题目答题记录
        return true; // 示例返回值
    }

    @Override
    public List<Question> listByPaperId(Integer paperId) {
        return enforceQuestionCount(questionMapper.selectQuestionsByPaperId(paperId));
    }

    @Override
    public List<SessionQuestionSnapshot> listSessionQuestionSnapshotsByPaperId(Integer paperId) {
        return enforceSnapshotCount(questionMapper.selectSessionQuestionSnapshotsByPaperId(paperId));
    }

    @Override
    public List<SessionQuestionSnapshot> listSessionQuestionSnapshotsBySessionId(Integer sessionId) {
        return enforceSnapshotCount(questionMapper.selectSessionQuestionSnapshotsBySessionId(sessionId));
    }

    private List<SessionQuestionSnapshot> enforceSnapshotCount(List<SessionQuestionSnapshot> snapshots) {
        if (snapshots.size() > MAX_QUESTIONS_PER_PAPER) {
            throw new ContentCryptoPayloadTooLargeException("单张试卷题目数量超过 200 道");
        }
        return snapshots;
    }

    @Override
    public Question getById(Integer questionId) {
        return questionMapper.selectById(questionId);
    }

    private List<Question> enforceQuestionCount(List<Question> questions) {
        if (questions.size() > MAX_QUESTIONS_PER_PAPER) {
            throw new ContentCryptoPayloadTooLargeException("单张试卷题目数量超过 200 道");
        }
        return questions;
    }


}
