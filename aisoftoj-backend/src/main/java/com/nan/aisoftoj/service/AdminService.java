package com.nan.aisoftoj.service;

import com.nan.aisoftoj.dto.PageDTO;
import com.nan.aisoftoj.dto.admin.AdminDashboardDTO;
import com.nan.aisoftoj.dto.admin.AdminQuestionDTO;
import com.nan.aisoftoj.dto.admin.AdminQuestionRequest;
import com.nan.aisoftoj.dto.admin.AdminUserDTO;
import com.nan.aisoftoj.dto.admin.AdminUserUpdateRequest;

import java.util.List;

public interface AdminService {
    AdminDashboardDTO getDashboard();

    PageDTO<AdminUserDTO> listUsers(String keyword, Boolean enabled, Integer page, Integer pageSize);

    AdminUserDTO updateUser(Integer userId, AdminUserUpdateRequest request);

    void deleteUser(Integer userId);

    PageDTO<AdminQuestionDTO> listQuestions(String keyword, Integer questionType, Integer difficulty,
                                            String subjectName, Integer year, Integer month, Integer paperCateId,
                                            Integer page, Integer pageSize);

    AdminQuestionDTO createQuestion(AdminQuestionRequest request);

    AdminQuestionDTO updateQuestion(Integer questionId, AdminQuestionRequest request);

    void deleteQuestion(Integer questionId);

    List<String> listSubjectNames();

    List<Integer> listPaperYears();

    List<Integer> listPaperMonths();
}
