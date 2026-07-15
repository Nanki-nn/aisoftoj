package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.dto.PageDTO;
import com.nan.aisoftoj.dto.ResultDTO;
import com.nan.aisoftoj.dto.admin.AdminDashboardDTO;
import com.nan.aisoftoj.dto.admin.AdminQuestionDTO;
import com.nan.aisoftoj.dto.admin.AdminQuestionRequest;
import com.nan.aisoftoj.dto.admin.AdminUserDTO;
import com.nan.aisoftoj.dto.admin.AdminUserUpdateRequest;
import com.nan.aisoftoj.service.AdminService;
import com.nan.aisoftoj.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

@RestController
@RequestMapping("/admin")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @Autowired
    private AuthService authService;

    @GetMapping("/dashboard")
    public ResultDTO<AdminDashboardDTO> dashboard(HttpServletRequest request) {
        requireAdmin(request);
        return ResultDTO.success(adminService.getDashboard());
    }

    @GetMapping("/users")
    public ResultDTO<PageDTO<AdminUserDTO>> listUsers(HttpServletRequest request,
                                                       @RequestParam(required = false) String keyword,
                                                       @RequestParam(required = false) Boolean enabled,
                                                       @RequestParam(defaultValue = "1") Integer page,
                                                       @RequestParam(defaultValue = "10") Integer pageSize) {
        requireAdmin(request);
        return ResultDTO.success(adminService.listUsers(keyword, enabled, page, pageSize));
    }

    @PutMapping("/users/{userId}")
    public ResultDTO<AdminUserDTO> updateUser(HttpServletRequest request,
                                              @PathVariable Integer userId,
                                              @RequestBody AdminUserUpdateRequest updateRequest) {
        requireAdmin(request);
        return ResultDTO.success(adminService.updateUser(userId, updateRequest));
    }

    @DeleteMapping("/users/{userId}")
    public ResultDTO<Void> deleteUser(HttpServletRequest request, @PathVariable Integer userId) {
        requireAdmin(request);
        adminService.deleteUser(userId);
        return ResultDTO.success();
    }

    @GetMapping("/questions")
    public ResultDTO<PageDTO<AdminQuestionDTO>> listQuestions(HttpServletRequest request,
                                                              @RequestParam(required = false) String keyword,
                                                              @RequestParam(required = false) Integer questionType,
                                                              @RequestParam(required = false) Integer difficulty,
                                                              @RequestParam(required = false) String subjectName,
                                                              @RequestParam(required = false) Integer year,
                                                              @RequestParam(required = false) Integer month,
                                                              @RequestParam(required = false) Integer paperCateId,
                                                              @RequestParam(defaultValue = "1") Integer page,
                                                              @RequestParam(defaultValue = "10") Integer pageSize) {
        requireAdmin(request);
        return ResultDTO.success(adminService.listQuestions(keyword, questionType, difficulty, subjectName, year, month, paperCateId, page, pageSize));
    }

    @PostMapping("/questions")
    public ResultDTO<AdminQuestionDTO> createQuestion(HttpServletRequest request,
                                                      @Validated @RequestBody AdminQuestionRequest questionRequest) {
        requireAdmin(request);
        return ResultDTO.success(adminService.createQuestion(questionRequest));
    }

    @PutMapping("/questions/{questionId}")
    public ResultDTO<AdminQuestionDTO> updateQuestion(HttpServletRequest request,
                                                      @PathVariable Integer questionId,
                                                      @Validated @RequestBody AdminQuestionRequest questionRequest) {
        requireAdmin(request);
        return ResultDTO.success(adminService.updateQuestion(questionId, questionRequest));
    }

    @DeleteMapping("/questions/{questionId}")
    public ResultDTO<Void> deleteQuestion(HttpServletRequest request, @PathVariable Integer questionId) {
        requireAdmin(request);
        adminService.deleteQuestion(questionId);
        return ResultDTO.success();
    }

    @GetMapping("/questions/subjects")
    public ResultDTO<List<String>> listSubjects(HttpServletRequest request) {
        requireAdmin(request);
        return ResultDTO.success(adminService.listSubjectNames());
    }

    @GetMapping("/questions/years")
    public ResultDTO<List<Integer>> listYears(HttpServletRequest request) {
        requireAdmin(request);
        return ResultDTO.success(adminService.listPaperYears());
    }

    @GetMapping("/questions/months")
    public ResultDTO<List<Integer>> listMonths(HttpServletRequest request) {
        requireAdmin(request);
        return ResultDTO.success(adminService.listPaperMonths());
    }

    private void requireAdmin(HttpServletRequest request) {
        authService.requireAdmin(request.getHeader("Authorization"));
    }
}
