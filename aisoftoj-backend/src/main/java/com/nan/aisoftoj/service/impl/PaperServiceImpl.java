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
import java.util.Map;
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

        List<PracticeSession> sessions = practiceSessionMapper.selectList(Wrappers.lambdaQuery(PracticeSession.class)
                .eq(PracticeSession::getIsDeleted, false)
                .eq(PracticeSession::getUserId, 1));

        Map<Integer, Integer> doingSessionIdByPaperId = sessions.stream()
                .filter(session -> PracticeSessionState.DOING.getCode() == session.getStatus())
                .collect(Collectors.toMap(
                        PracticeSession::getPaperId,
                        PracticeSession::getId,
                        (existing, replacement) -> replacement
                ));
        Set<Integer> doingPaperIds = sessions.stream()
                .filter(session -> PracticeSessionState.DOING.getCode() == session.getStatus())
                .map(PracticeSession::getPaperId)
                .collect(Collectors.toSet());
        Set<Integer> finishedPaperIds = sessions.stream()
                .filter(session -> PracticeSessionState.FINISHED.getCode() == session.getStatus())
                .map(PracticeSession::getPaperId)
                .collect(Collectors.toSet());

        // Convert Paper entities to PaperDTO with progress information
        return papers.stream().map(paper -> {
            PaperDTO dto = new PaperDTO();
            // Copy all properties from Paper to PaperDTO
            dto.setId(paper.getId());
            dto.setFrontMockId(paper.getFrontMockId());
            dto.setPaperCateId(paper.getPaperCateId());
            dto.setPaperSubjectId(paper.getSubjectId());
            dto.setSubjectName(paper.getSubjectName());
            dto.setPaperYear(paper.getPaperYear());
            dto.setPaperMonth(paper.getPaperMonth());
            dto.setName(paper.getName());
            dto.setOrderNum(paper.getOrderNum());
            dto.setQuestionTotal(paper.getQuestionTotal());
            dto.setReadCt(paper.getReadCt());
            dto.setIsDeleted(paper.getIsDeleted());
            dto.setCreateTime(paper.getCreateTime());
            dto.setUpdateTime(paper.getUpdateTime());
            dto.setCompletedCount(paper.getCompletedCount());
            dto.setDoingSessionId(doingSessionIdByPaperId.get(paper.getId()));
            // 4. Prefer real practice-session state over any stale imported mock status.
            String paperStatus;
            if (doingPaperIds.contains(paper.getId())) {
                paperStatus = PaperStatus.IN_PROGRESS;
            } else if (finishedPaperIds.contains(paper.getId())) {
                paperStatus = PaperStatus.COMPLETED;
            } else {
                paperStatus = PaperStatus.NOT_STARTED;
            }
            dto.setPaperStatus(paperStatus);
            dto.setProgress(PaperStatus.COMPLETED.equals(paperStatus)
                    ? paper.getQuestionTotal()
                    : (paper.getCompletedCount() == null ? 0 : paper.getCompletedCount()));
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

        List<PracticeSession> sessions = practiceSessionMapper.selectList(Wrappers.lambdaQuery(PracticeSession.class)
                .eq(PracticeSession::getIsDeleted, false)
                .eq(PracticeSession::getUserId, 1));

        Map<Integer, Integer> doingSessionIdByPaperId = sessions.stream()
                .filter(session -> PracticeSessionState.DOING.getCode() == session.getStatus())
                .collect(Collectors.toMap(
                        PracticeSession::getPaperId,
                        PracticeSession::getId,
                        (existing, replacement) -> replacement
                ));
        Set<Integer> doingPaperIds = sessions.stream()
                .filter(session -> PracticeSessionState.DOING.getCode() == session.getStatus())
                .map(PracticeSession::getPaperId)
                .collect(Collectors.toSet());
        Set<Integer> finishedPaperIds = sessions.stream()
                .filter(session -> PracticeSessionState.FINISHED.getCode() == session.getStatus())
                .map(PracticeSession::getPaperId)
                .collect(Collectors.toSet());

        // Convert Paper entities to PaperDTO with progress information
        return papers.stream().map(paper -> {
            PaperDTO dto = new PaperDTO();
            // Copy all properties from Paper to PaperDTO
            dto.setId(paper.getId());
            dto.setFrontMockId(paper.getFrontMockId());
            dto.setPaperCateId(paper.getPaperCateId());
            dto.setPaperSubjectId(paper.getSubjectId());
            dto.setSubjectName(paper.getSubjectName());
            dto.setPaperYear(paper.getPaperYear());
            dto.setPaperMonth(paper.getPaperMonth());
            dto.setName(paper.getName());
            dto.setOrderNum(paper.getOrderNum());
            dto.setQuestionTotal(paper.getQuestionTotal());
            dto.setReadCt(paper.getReadCt());
            dto.setIsDeleted(paper.getIsDeleted());
            dto.setCreateTime(paper.getCreateTime());
            dto.setUpdateTime(paper.getUpdateTime());
            dto.setCompletedCount(paper.getCompletedCount());
            dto.setDoingSessionId(doingSessionIdByPaperId.get(paper.getId()));
            String paperStatus;
            if (doingPaperIds.contains(paper.getId())) {
                paperStatus = PaperStatus.IN_PROGRESS;
            } else if (finishedPaperIds.contains(paper.getId())) {
                paperStatus = PaperStatus.COMPLETED;
            } else {
                paperStatus = PaperStatus.NOT_STARTED;
            }
            dto.setPaperStatus(paperStatus);
            dto.setProgress(PaperStatus.COMPLETED.equals(paperStatus)
                    ? paper.getQuestionTotal()
                    : (paper.getCompletedCount() == null ? 0 : paper.getCompletedCount()));
            return dto;
        }).collect(Collectors.toList());
    }

    @Override
    public Paper getById(Integer id) {
        return paperMapper.selectById(id);
    }


}
