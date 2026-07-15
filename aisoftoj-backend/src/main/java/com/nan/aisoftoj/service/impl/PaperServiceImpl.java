package com.nan.aisoftoj.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
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

import java.util.Collections;
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
    public List<PaperDTO> getAllPapers(Integer userId) {
        return getCatalog(userId, null, null);
    }

    @Override
    public List<PaperDTO> getPapers(Integer userId, Integer subjectId, Integer cateId) {
        return getCatalog(userId, subjectId, cateId);
    }

    private List<PaperDTO> getCatalog(Integer userId, Integer subjectId, Integer cateId) {
        LambdaQueryWrapper<Paper> query = Wrappers.lambdaQuery(Paper.class)
                .eq(Paper::getIsDeleted, false)
                .eq(Paper::getPublishStatus, true)
                .eq(subjectId != null, Paper::getSubjectId, subjectId)
                .eq(cateId != null, Paper::getPaperCateId, cateId)
                .orderByDesc(Paper::getPaperYear)
                .orderByDesc(Paper::getPaperMonth)
                .orderByAsc(Paper::getOrderNum);
        List<Paper> papers = paperMapper.selectList(query);

        // 游客目录只查询公开试卷，绝不触发任何个人会话查询。
        List<PracticeSession> sessions = userId == null
                ? Collections.emptyList()
                : practiceSessionMapper.selectList(Wrappers.lambdaQuery(PracticeSession.class)
                        .eq(PracticeSession::getIsDeleted, false)
                        .eq(PracticeSession::getUserId, userId));

        Map<Integer, Long> sessionCountByPaperId = sessions.stream()
                .collect(Collectors.groupingBy(PracticeSession::getPaperId, Collectors.counting()));
        Map<Integer, Integer> doingSessionIdByPaperId = sessions.stream()
                .filter(this::isDoing)
                .collect(Collectors.toMap(
                        PracticeSession::getPaperId,
                        PracticeSession::getId,
                        (existing, replacement) -> replacement));
        Set<Integer> doingPaperIds = sessions.stream()
                .filter(this::isDoing)
                .map(PracticeSession::getPaperId)
                .collect(Collectors.toSet());
        Set<Integer> finishedPaperIds = sessions.stream()
                .filter(this::isFinished)
                .map(PracticeSession::getPaperId)
                .collect(Collectors.toSet());

        return papers.stream()
                .map(paper -> toCatalogDTO(
                        paper,
                        userId,
                        sessionCountByPaperId,
                        doingSessionIdByPaperId,
                        doingPaperIds,
                        finishedPaperIds))
                .collect(Collectors.toList());
    }

    private PaperDTO toCatalogDTO(
            Paper paper,
            Integer userId,
            Map<Integer, Long> sessionCountByPaperId,
            Map<Integer, Integer> doingSessionIdByPaperId,
            Set<Integer> doingPaperIds,
            Set<Integer> finishedPaperIds) {
        PaperDTO dto = new PaperDTO();
        dto.setId(paper.getId());
        dto.setName(paper.getName());
        dto.setSubjectName(paper.getSubjectName());
        dto.setPaperCateId(paper.getPaperCateId());
        dto.setPaperYear(paper.getPaperYear());
        dto.setPaperMonth(paper.getPaperMonth());
        dto.setQuestionTotal(paper.getQuestionTotal());
        dto.setUpdateTime(paper.getUpdateTime());

        if (userId != null) {
            dto.setReadCt(sessionCountByPaperId.getOrDefault(paper.getId(), 0L).intValue());
            dto.setDoingSessionId(doingSessionIdByPaperId.get(paper.getId()));
            if (doingPaperIds.contains(paper.getId())) {
                dto.setPaperStatus(PaperStatus.IN_PROGRESS);
            } else if (finishedPaperIds.contains(paper.getId())) {
                dto.setPaperStatus(PaperStatus.COMPLETED);
            } else {
                dto.setPaperStatus(PaperStatus.NOT_STARTED);
            }
        }
        return dto;
    }

    private boolean isDoing(PracticeSession session) {
        return session.getStatus() != null
                && session.getStatus() == PracticeSessionState.DOING.getCode();
    }

    private boolean isFinished(PracticeSession session) {
        return session.getStatus() != null
                && session.getStatus() == PracticeSessionState.FINISHED.getCode();
    }

    @Override
    public Paper getPublishedPaper(Integer id) {
        return paperMapper.selectOne(Wrappers.lambdaQuery(Paper.class)
                .eq(Paper::getId, id)
                .eq(Paper::getIsDeleted, false)
                .eq(Paper::getPublishStatus, true)
                .last("LIMIT 1"));
    }

    @Override
    public Paper getById(Integer id) {
        return paperMapper.selectById(id);
    }
}
