package com.nan.aisoftoj.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.nan.aisoftoj.consts.PaperStatus;
import com.nan.aisoftoj.consts.PracticeSessionState;
import com.nan.aisoftoj.dto.PaperDTO;
import com.nan.aisoftoj.entity.Paper;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.mapper.PaperMapper;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.service.PaperService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class PaperServiceImpl implements PaperService {

    @Autowired
    private PaperMapper paperMapper;
    @Autowired
    private PracticeSessionMapper practiceSessionMapper;


    @Override
    public List<PaperDTO> getAllPapers() {
        //1.查询所有试卷基本信息
        List<Paper> papers = paperMapper.selectList(Wrappers.lambdaQuery(Paper.class)
                .eq(Paper::getIsDeleted, false));

        //2.查询是否有正在进行的会话记录
        Set<Integer> doingPaperIds = practiceSessionMapper.selectList(Wrappers.lambdaQuery(PracticeSession.class)
                           .eq(PracticeSession::getIsDeleted, false)
                           .eq(PracticeSession::getUserId, 1)
                           .eq(PracticeSession::getStatus, PracticeSessionState.DOING.getCode()))
                .stream()
                .map(PracticeSession::getPaperId)
                .collect(Collectors.toSet());

        // Convert Paper entities to PaperDTO with progress information
        return papers.stream().map(paper -> {
            PaperDTO dto = new PaperDTO();
            // Copy all properties from Paper to PaperDTO
            dto.setId(paper.getId());
            dto.setPaperCateId(paper.getPaperCateId());
            dto.setPaperSubjectId(paper.getSubjectId());
            dto.setName(paper.getName());
            dto.setOrderNum(paper.getOrderNum());
            dto.setQuestionTotal(paper.getQuestionTotal());
            dto.setReadCt(paper.getReadCt());
            dto.setIsDeleted(paper.getIsDeleted());
            dto.setCreateTime(paper.getCreateTime());
            dto.setUpdateTime(paper.getUpdateTime());
            // 3. Check if this paper has an ongoing record
            Integer doingSessionId = doingPaperIds.contains(paper.getId()) ? paper.getId() : null;
            dto.setDoingSessionId(doingSessionId);
            // 4. Set paper status based on whether it has an ongoing record
            dto.setPaperStatus(doingSessionId == null ? PaperStatus.NOT_STARTED : PaperStatus.IN_PROGRESS);
            return dto;
        }).collect(Collectors.toList());
    }

    @Override
    public List<PaperDTO> getPapers(Integer subjectId, Integer cateId) {

        //1.查询试卷基本信息
        List<Paper> papers = paperMapper.selectList(Wrappers.lambdaQuery(Paper.class)
                .eq(Paper::getIsDeleted, false)
                .eq(subjectId != null, Paper::getSubjectId, subjectId)
                .eq(cateId != null, Paper::getPaperCateId, cateId));

        //2.查询是否有正在进行的会话记录
        Set<Integer> doingPaperIds = practiceSessionMapper.selectList(Wrappers.lambdaQuery(PracticeSession.class)
                           .eq(PracticeSession::getIsDeleted, false)
                           .eq(PracticeSession::getUserId, 1)
                           .eq(PracticeSession::getStatus, PracticeSessionState.DOING.getCode()))
                .stream()
                .map(PracticeSession::getPaperId)
                .collect(Collectors.toSet());

        // Convert Paper entities to PaperDTO with progress information
        return papers.stream().map(paper -> {
            PaperDTO dto = new PaperDTO();
            // Copy all properties from Paper to PaperDTO
            dto.setId(paper.getId());
            dto.setPaperCateId(paper.getPaperCateId());
            dto.setPaperSubjectId(paper.getSubjectId());
            dto.setName(paper.getName());
            dto.setOrderNum(paper.getOrderNum());
            dto.setQuestionTotal(paper.getQuestionTotal());
            dto.setReadCt(paper.getReadCt());
            dto.setIsDeleted(paper.getIsDeleted());
            dto.setCreateTime(paper.getCreateTime());
            dto.setUpdateTime(paper.getUpdateTime());
            // 3. Check if this paper has an ongoing record
            Integer doingSessionId = doingPaperIds.contains(paper.getId()) ? paper.getId() : null;
            dto.setDoingSessionId(doingSessionId);
            // 4. Set paper status based on whether it has an ongoing record
            dto.setPaperStatus(doingSessionId == null ? PaperStatus.NOT_STARTED : PaperStatus.IN_PROGRESS);
            return dto;
        }).collect(Collectors.toList());
    }

    @Override
    public Paper getById(Integer id) {
        return paperMapper.selectById(id);
    }


}