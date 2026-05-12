package com.nan.aisoftoj.service.impl;

import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.nan.aisoftoj.dto.PageDTO;
import com.nan.aisoftoj.dto.admin.AdminDashboardDTO;
import com.nan.aisoftoj.dto.admin.AdminQuestionDTO;
import com.nan.aisoftoj.dto.admin.AdminQuestionRequest;
import com.nan.aisoftoj.dto.admin.AdminUserDTO;
import com.nan.aisoftoj.dto.admin.AdminUserUpdateRequest;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.entity.UserWrongQuestionStat;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.QuestionMapper;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import com.nan.aisoftoj.service.AdminService;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AdminServiceImpl implements AdminService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private QuestionMapper questionMapper;

    @Autowired
    private PracticeSessionMapper practiceSessionMapper;

    @Autowired
    private UserWrongQuestionStatMapper userWrongQuestionStatMapper;

    @Override
    public AdminDashboardDTO getDashboard() {
        AdminDashboardDTO dto = new AdminDashboardDTO();
        dto.setUserTotal(userMapper.selectCount(Wrappers.lambdaQuery(User.class)
                .eq(User::getIsDeleted, false)));
        dto.setEnabledUserTotal(userMapper.selectCount(Wrappers.lambdaQuery(User.class)
                .eq(User::getIsDeleted, false)
                .eq(User::getIsEnabled, true)));
        dto.setQuestionTotal(questionMapper.selectCount(Wrappers.lambdaQuery(Question.class)));
        dto.setActiveQuestionTotal(questionMapper.selectCount(Wrappers.lambdaQuery(Question.class)
                .eq(Question::getIsDeleted, 0)));
        return dto;
    }

    @Override
    public PageDTO<AdminUserDTO> listUsers(String keyword, Boolean enabled, Integer page, Integer pageSize) {
        LambdaQueryWrapper<User> query = Wrappers.lambdaQuery(User.class)
                .eq(User::getIsDeleted, false)
                .orderByDesc(User::getCreateTime);
        if (StrUtil.isNotBlank(keyword)) {
            String likeValue = keyword.trim();
            query.and(wrapper -> wrapper.like(User::getLoginName, likeValue)
                    .or()
                    .like(User::getNickName, likeValue)
                    .or()
                    .like(User::getEmail, likeValue)
                    .or()
                    .like(User::getPhone, likeValue));
        }
        if (enabled != null) {
            query.eq(User::getIsEnabled, enabled);
        }

        IPage<User> result = userMapper.selectPage(new Page<>(normalizePage(page), normalizePageSize(pageSize)), query);
        List<AdminUserDTO> records = result.getRecords().stream()
                .map(this::toAdminUserDTO)
                .collect(Collectors.toList());
        return new PageDTO<>(records, result.getTotal(), (int) result.getCurrent(), (int) result.getSize());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminUserDTO updateUser(Integer userId, AdminUserUpdateRequest request) {
        User user = userMapper.selectById(userId);
        if (user == null || Boolean.TRUE.equals(user.getIsDeleted())) {
            throw new IllegalArgumentException("用户不存在");
        }
        if (StrUtil.isNotBlank(request.getLoginName())) {
            user.setLoginName(request.getLoginName().trim());
        }
        if (request.getNickName() != null) {
            user.setNickName(request.getNickName().trim());
        }
        if (request.getEmail() != null) {
            user.setEmail(StrUtil.blankToDefault(request.getEmail().trim(), null));
        }
        if (request.getPhone() != null) {
            user.setPhone(StrUtil.blankToDefault(request.getPhone().trim(), null));
        }
        if (request.getIsEnabled() != null) {
            user.setIsEnabled(request.getIsEnabled());
        }
        userMapper.updateById(user);
        return toAdminUserDTO(userMapper.selectById(userId));
    }

    @Override
    public void deleteUser(Integer userId) {
        User user = userMapper.selectById(userId);
        if (user == null || Boolean.TRUE.equals(user.getIsDeleted())) {
            throw new IllegalArgumentException("用户不存在");
        }
        user.setIsDeleted(true);
        userMapper.updateById(user);
    }

    @Override
    public PageDTO<AdminQuestionDTO> listQuestions(String keyword, Integer questionType, Integer difficulty,
                                                   String subjectName, Integer year, Integer month, Integer paperCateId,
                                                   Integer page, Integer pageSize) {
        LambdaQueryWrapper<Question> query = Wrappers.lambdaQuery(Question.class)
                .eq(Question::getIsDeleted, 0)
                .orderByDesc(Question::getUpdateTime);
        if (StrUtil.isNotBlank(keyword)) {
            String likeValue = keyword.trim();
            query.and(wrapper -> wrapper.like(Question::getName, likeValue)
                    .or()
                    .like(Question::getIntro, likeValue)
                    .or()
                    .like(Question::getAnalysis, likeValue));
        }
        if (questionType != null) {
            query.eq(Question::getQuestionType, questionType);
        }
        if (difficulty != null) {
            query.eq(Question::getDifficulty, difficulty);
        }
        // 按科目/年份/月份/题型分类过滤：先查出符合条件的题目 ID
        if (StrUtil.isNotBlank(subjectName) || year != null || month != null || paperCateId != null) {
            List<Integer> filteredIds = questionMapper.selectQuestionIdsByPaperFilter(
                    StrUtil.isNotBlank(subjectName) ? subjectName.trim() : null, year, month, paperCateId);
            if (filteredIds.isEmpty()) {
                return new PageDTO<AdminQuestionDTO>(Collections.emptyList(), 0L, (int) normalizePage(page), (int) normalizePageSize(pageSize));
            }
            query.in(Question::getId, filteredIds);
        }

        IPage<Question> result = questionMapper.selectPage(
                new Page<>(normalizePage(page), normalizePageSize(pageSize)), query);
        List<Question> records = result.getRecords();

        // 批量查询关联试卷信息
        Map<Integer, Map<String, Object>> paperInfoMap = Collections.emptyMap();
        if (!records.isEmpty()) {
            String idStr = records.stream()
                    .map(q -> String.valueOf(q.getId()))
                    .collect(Collectors.joining(","));
            List<Map<String, Object>> paperInfoList = questionMapper.selectPaperInfoByQuestionIds(idStr);
            paperInfoMap = paperInfoList.stream()
                    .collect(Collectors.toMap(
                            m -> ((Number) m.get("questionId")).intValue(),
                            m -> m,
                            (a, b) -> a));
        }

        final Map<Integer, Map<String, Object>> finalPaperInfoMap = paperInfoMap;
        List<AdminQuestionDTO> dtos = records.stream()
                .map(q -> toAdminQuestionDTO(q, finalPaperInfoMap.get(q.getId())))
                .collect(Collectors.toList());
        return new PageDTO<>(dtos, result.getTotal(), (int) result.getCurrent(), (int) result.getSize());
    }

    @Override
    public AdminQuestionDTO createQuestion(AdminQuestionRequest request) {
        Question question = new Question();
        fillQuestion(question, request);
        question.setIsDeleted(0);
        question.setReadCt(0);
        questionMapper.insert(question);
        return toAdminQuestionDTO(questionMapper.selectById(question.getId()));
    }

    @Override
    public AdminQuestionDTO updateQuestion(Integer questionId, AdminQuestionRequest request) {
        Question question = questionMapper.selectById(questionId);
        if (question == null || Integer.valueOf(1).equals(question.getIsDeleted())) {
            throw new IllegalArgumentException("题目不存在");
        }
        fillQuestion(question, request);
        questionMapper.updateById(question);
        return toAdminQuestionDTO(questionMapper.selectById(questionId));
    }

    @Override
    public void deleteQuestion(Integer questionId) {
        Question question = questionMapper.selectById(questionId);
        if (question == null || Integer.valueOf(1).equals(question.getIsDeleted())) {
            throw new IllegalArgumentException("题目不存在");
        }
        question.setIsDeleted(1);
        questionMapper.updateById(question);
    }

    @Override
    public List<String> listSubjectNames() {
        return questionMapper.selectDistinctSubjectNames();
    }

    @Override
    public List<Integer> listPaperYears() {
        return questionMapper.selectDistinctPaperYears();
    }

    @Override
    public List<Integer> listPaperMonths() {
        return questionMapper.selectDistinctPaperMonths();
    }

    private void fillQuestion(Question question, AdminQuestionRequest request) {
        question.setName(request.getName().trim());
        question.setIntro(StrUtil.blankToDefault(request.getIntro(), ""));
        question.setOptions(StrUtil.blankToDefault(request.getOptions(), "[]"));
        question.setAnswer(request.getAnswer().trim());
        question.setAnalysis(StrUtil.blankToDefault(request.getAnalysis(), ""));
        question.setQuestionType(request.getQuestionType());
        question.setDifficulty(request.getDifficulty());
    }

    private AdminUserDTO toAdminUserDTO(User user) {
        AdminUserDTO dto = new AdminUserDTO();
        BeanUtils.copyProperties(user, dto);
        dto.setSessionCount(practiceSessionMapper.selectCount(Wrappers.lambdaQuery(PracticeSession.class)
                .eq(PracticeSession::getUserId, user.getId())
                .eq(PracticeSession::getIsDeleted, false)));
        dto.setWrongQuestionCount(userWrongQuestionStatMapper.selectCount(Wrappers.lambdaQuery(UserWrongQuestionStat.class)
                .eq(UserWrongQuestionStat::getUserId, user.getId())
                .eq(UserWrongQuestionStat::getIsDeleted, false)));
        return dto;
    }

    private AdminQuestionDTO toAdminQuestionDTO(Question question) {
        return toAdminQuestionDTO(question, null);
    }

    private AdminQuestionDTO toAdminQuestionDTO(Question question, Map<String, Object> paperInfo) {
        AdminQuestionDTO dto = new AdminQuestionDTO();
        BeanUtils.copyProperties(question, dto);
        if (paperInfo != null) {
            Object subjectName = paperInfo.get("subjectName");
            Object paperYear = paperInfo.get("paperYear");
            Object paperCateId = paperInfo.get("paperCateId");
            if (subjectName != null) {
                dto.setSubjectName(subjectName.toString());
            }
            if (paperYear != null) {
                dto.setPaperYear(((Number) paperYear).intValue());
            }
            Object paperMonth = paperInfo.get("paperMonth");
            if (paperMonth != null) {
                dto.setPaperMonth(((Number) paperMonth).intValue());
            }
            if (paperCateId != null) {
                dto.setPaperCateId(((Number) paperCateId).intValue());
            }
        }
        return dto;
    }

    private long normalizePage(Integer page) {
        return page == null || page < 1 ? 1 : page;
    }

    private long normalizePageSize(Integer pageSize) {
        if (pageSize == null || pageSize < 1) {
            return 10;
        }
        return Math.min(pageSize, 100);
    }
}
