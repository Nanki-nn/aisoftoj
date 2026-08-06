package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.auth.EmailCodeScene;
import com.nan.aisoftoj.common.ConflictException;
import com.nan.aisoftoj.common.InvalidEmailCodeException;
import com.nan.aisoftoj.common.UserRole;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.entity.UserWrongQuestionStat;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.PracticeSessionQuestionRecordMapper;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import com.nan.aisoftoj.service.EmailCodeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;

import java.util.Date;
import java.util.Arrays;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailBindingServiceTest {
    @Mock
    private UserMapper userMapper;
    @Mock
    private EmailCodeService emailCodeService;
    @Mock
    private PracticeSessionMapper practiceSessionMapper;
    @Mock
    private PracticeSessionQuestionRecordMapper questionRecordMapper;
    @Mock
    private UserWrongQuestionStatMapper wrongQuestionMapper;

    private EmailBindingService service;

    @BeforeEach
    void setUp() {
        service = new EmailBindingService(
                userMapper,
                emailCodeService,
                practiceSessionMapper,
                questionRecordMapper,
                wrongQuestionMapper);
    }

    @Test
    void bindsNewEmailAfterLockingUserAndConsumingCode() {
        User current = wxOnlyUser();
        when(userMapper.selectById(7)).thenReturn(current);
        when(userMapper.selectAnyByNormalizedEmail("user@example.com")).thenReturn(null);
        when(userMapper.selectByIdForUpdate(7)).thenReturn(current);
        when(userMapper.selectAnyByNormalizedEmailForUpdate("user@example.com")).thenReturn(null);
        when(userMapper.updateById(current)).thenReturn(1);

        User bound = service.bind(7, " USER@example.com ", "123456");

        assertSame(current, bound);
        assertEquals("user@example.com", current.getEmail());
        assertEquals("user@example.com", current.getEmailNormalized());
        assertNotNull(current.getEmailVerifiedAt());
        verify(emailCodeService).consumeCode(
                "user@example.com", EmailCodeScene.BIND_EMAIL, "123456");
        verify(userMapper).updateById(current);
    }

    @Test
    void existingAccountMergeLocksUsersInIdOrderAndTransfersIdentity() {
        User current = wxOnlyUser();
        User existing = activeUser(9, UserRole.USER.name());
        existing.setEmail("user@example.com");
        existing.setEmailNormalized("user@example.com");
        existing.setEmailVerifiedAt(new Date());
        when(userMapper.selectById(7)).thenReturn(current);
        when(userMapper.selectAnyByNormalizedEmail("user@example.com")).thenReturn(existing);
        when(userMapper.selectPairForUpdate(7, 9)).thenReturn(Arrays.asList(current, existing));
        when(userMapper.selectAnyByNormalizedEmailForUpdate("user@example.com")).thenReturn(existing);
        when(practiceSessionMapper.selectForAccountMerge(7, 9)).thenReturn(Collections.emptyList());
        when(wrongQuestionMapper.selectForAccountMerge(7, 9)).thenReturn(Collections.emptyList());
        when(userMapper.updateById(current)).thenReturn(1);
        when(userMapper.updateById(existing)).thenReturn(1);

        assertSame(existing, service.bind(7, "user@example.com", "123456"));

        verify(emailCodeService).consumeCode(
                "user@example.com", EmailCodeScene.BIND_EMAIL, "123456");
        assertEquals("openid-1", existing.getWxOpenId());
        assertEquals(null, current.getWxOpenId());
        assertEquals(1, current.getTokenVersion());
        assertEquals(true, current.getIsDeleted());
        org.mockito.InOrder order = inOrder(userMapper, emailCodeService, practiceSessionMapper,
                wrongQuestionMapper);
        order.verify(userMapper).selectPairForUpdate(7, 9);
        order.verify(emailCodeService).consumeCode(
                "user@example.com", EmailCodeScene.BIND_EMAIL, "123456");
        order.verify(practiceSessionMapper).selectForAccountMerge(7, 9);
        order.verify(wrongQuestionMapper).selectForAccountMerge(7, 9);
        order.verify(userMapper).updateById(current);
        order.verify(userMapper).updateById(existing);
    }

    @Test
    void accountMergeReconcilesSessionsAndWrongQuestions() {
        User current = wxOnlyUser();
        User existing = activeUser(9, UserRole.USER.name());
        existing.setEmail("user@example.com");
        existing.setEmailNormalized("user@example.com");
        existing.setEmailVerifiedAt(new Date());
        PracticeSession targetActive = session(20, 9, 3, "practice", 0);
        PracticeSession sourceActive = session(10, 7, 3, "practice", 0);
        PracticeSession sourceFinished = session(11, 7, 4, "exam", 1);
        UserWrongQuestionStat targetWrong = wrong(200L, 9, 101, 2, "medium", 20);
        UserWrongQuestionStat sourceWrong = wrong(100L, 7, 101, 3, "high", 10);
        sourceWrong.setLastWrongTime(new Date(targetWrong.getLastWrongTime().getTime() + 1000));

        when(userMapper.selectById(7)).thenReturn(current);
        when(userMapper.selectAnyByNormalizedEmail("user@example.com")).thenReturn(existing);
        when(userMapper.selectPairForUpdate(7, 9)).thenReturn(Arrays.asList(current, existing));
        when(userMapper.selectAnyByNormalizedEmailForUpdate("user@example.com")).thenReturn(existing);
        when(practiceSessionMapper.selectForAccountMerge(7, 9))
                .thenReturn(Arrays.asList(sourceActive, sourceFinished, targetActive));
        when(wrongQuestionMapper.selectForAccountMerge(7, 9))
                .thenReturn(Arrays.asList(sourceWrong, targetWrong));
        when(practiceSessionMapper.recalculateAnsweredCount(20)).thenReturn(1);
        when(practiceSessionMapper.updateById(org.mockito.ArgumentMatchers.any(PracticeSession.class)))
                .thenReturn(1);
        when(wrongQuestionMapper.updateById(
                org.mockito.ArgumentMatchers.any(UserWrongQuestionStat.class))).thenReturn(1);
        when(userMapper.updateById(current)).thenReturn(1);
        when(userMapper.updateById(existing)).thenReturn(1);

        service.bind(7, "user@example.com", "123456");

        verify(questionRecordMapper).copyIntoBlankAnswers(10, 20);
        verify(practiceSessionMapper).recalculateAnsweredCount(20);
        assertEquals(2, sourceActive.getStatus());
        assertEquals(20, sourceActive.getMergedIntoSessionId());
        assertEquals(9, sourceFinished.getUserId());
        assertEquals(5, targetWrong.getErrorCount());
        assertEquals("high", targetWrong.getImportanceLevel());
        assertEquals(20, targetWrong.getLastSessionId());
        assertEquals(1, sourceWrong.getIsDeleted());
        verify(practiceSessionMapper).updateById(sourceActive);
        verify(practiceSessionMapper).updateById(sourceFinished);
        verify(wrongQuestionMapper).updateById(targetWrong);
        verify(wrongQuestionMapper).updateById(sourceWrong);
    }

    @Test
    void accountMergeLocksLowerTargetIdBeforeHigherTemporaryId() {
        User current = activeUser(12, UserRole.USER.name());
        current.setWxOpenId("openid-1");
        User existing = activeUser(9, UserRole.USER.name());
        existing.setEmail("user@example.com");
        existing.setEmailNormalized("user@example.com");
        existing.setEmailVerifiedAt(new Date());
        when(userMapper.selectById(12)).thenReturn(current);
        when(userMapper.selectAnyByNormalizedEmail("user@example.com")).thenReturn(existing);
        when(userMapper.selectPairForUpdate(9, 12)).thenReturn(Arrays.asList(existing, current));
        when(userMapper.selectAnyByNormalizedEmailForUpdate("user@example.com")).thenReturn(existing);
        when(practiceSessionMapper.selectForAccountMerge(9, 12)).thenReturn(Collections.emptyList());
        when(wrongQuestionMapper.selectForAccountMerge(9, 12)).thenReturn(Collections.emptyList());
        when(userMapper.updateById(current)).thenReturn(1);
        when(userMapper.updateById(existing)).thenReturn(1);

        assertSame(existing, service.bind(12, "user@example.com", "123456"));

        verify(userMapper).selectPairForUpdate(9, 12);
        verify(practiceSessionMapper).selectForAccountMerge(9, 12);
        verify(wrongQuestionMapper).selectForAccountMerge(9, 12);
    }

    @Test
    void accountMergeRejectsDifferentOpenIdBeforeConsumingCode() {
        User current = wxOnlyUser();
        User existing = activeUser(9, UserRole.USER.name());
        existing.setEmail("user@example.com");
        existing.setEmailNormalized("user@example.com");
        existing.setEmailVerifiedAt(new Date());
        existing.setWxOpenId("other-openid");
        when(userMapper.selectById(7)).thenReturn(current);
        when(userMapper.selectAnyByNormalizedEmail("user@example.com")).thenReturn(existing);
        when(userMapper.selectPairForUpdate(7, 9)).thenReturn(Arrays.asList(current, existing));
        when(userMapper.selectAnyByNormalizedEmailForUpdate("user@example.com")).thenReturn(existing);

        assertThrows(ConflictException.class,
                () -> service.bind(7, "user@example.com", "123456"));

        verify(emailCodeService, never()).consumeCode(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString());
        verify(practiceSessionMapper, never()).selectForAccountMerge(7, 9);
    }

    @Test
    void accountMergeHidesIneligibleTargetStateAsInvalidCode() {
        User current = wxOnlyUser();
        User admin = activeUser(9, UserRole.ADMIN.name());
        admin.setEmail("user@example.com");
        admin.setEmailNormalized("user@example.com");
        admin.setEmailVerifiedAt(new Date());
        when(userMapper.selectById(7)).thenReturn(current);
        when(userMapper.selectAnyByNormalizedEmail("user@example.com")).thenReturn(admin);
        when(userMapper.selectPairForUpdate(7, 9)).thenReturn(Arrays.asList(current, admin));
        when(userMapper.selectAnyByNormalizedEmailForUpdate("user@example.com")).thenReturn(admin);

        assertThrows(InvalidEmailCodeException.class,
                () -> service.bind(7, "user@example.com", "123456"));

        verify(emailCodeService, never()).consumeCode(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void sameBoundEmailIsIdempotentAfterWechatRelogin() {
        User current = wxOnlyUser();
        current.setEmail("user@example.com");
        current.setEmailNormalized("user@example.com");
        current.setEmailVerifiedAt(new Date());
        when(userMapper.selectById(7)).thenReturn(current);
        when(userMapper.selectByIdForUpdate(7)).thenReturn(current);

        assertSame(current, service.bind(7, "USER@example.com", "unused"));
        verify(emailCodeService, never()).consumeCode(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString());
        verify(userMapper, never()).updateById(current);
    }

    @Test
    void rejectsNonWxOnlyCallerBeforeConsumingCode() {
        User admin = activeUser(7, UserRole.ADMIN.name());
        admin.setWxOpenId("openid-1");
        when(userMapper.selectById(7)).thenReturn(admin);

        assertThrows(IllegalArgumentException.class,
                () -> service.bind(7, "user@example.com", "123456"));
        verify(emailCodeService, never()).consumeCode(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void concurrentEmailClaimBecomesConflictInsteadOfOverwrite() {
        User current = wxOnlyUser();
        when(userMapper.selectById(7)).thenReturn(current);
        when(userMapper.selectAnyByNormalizedEmail("user@example.com")).thenReturn(null);
        when(userMapper.selectByIdForUpdate(7)).thenReturn(current);
        when(userMapper.selectAnyByNormalizedEmailForUpdate("user@example.com")).thenReturn(null);
        doThrow(new DuplicateKeyException("uk_email_normalized"))
                .when(userMapper).updateById(current);

        assertThrows(ConflictException.class,
                () -> service.bind(7, "user@example.com", "123456"));

        verify(emailCodeService).consumeCode(
                "user@example.com", EmailCodeScene.BIND_EMAIL, "123456");
    }

    private User wxOnlyUser() {
        User user = activeUser(7, UserRole.USER.name());
        user.setWxOpenId("openid-1");
        return user;
    }

    private User activeUser(int id, String role) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        user.setIsEnabled(true);
        user.setIsDeleted(false);
        user.setTokenVersion(0);
        return user;
    }

    private PracticeSession session(int id, int userId, int paperId, String mode, int status) {
        PracticeSession session = new PracticeSession();
        session.setId(id);
        session.setUserId(userId);
        session.setPaperId(paperId);
        session.setExamMode(mode);
        session.setStatus(status);
        session.setIsDeleted(0);
        return session;
    }

    private UserWrongQuestionStat wrong(
            long id,
            int userId,
            int questionId,
            int errorCount,
            String importance,
            int lastSessionId) {
        UserWrongQuestionStat stat = new UserWrongQuestionStat();
        stat.setId(id);
        stat.setUserId(userId);
        stat.setQuestionId(questionId);
        stat.setErrorCount(errorCount);
        stat.setImportanceLevel(importance);
        stat.setLastSessionId(lastSessionId);
        stat.setLastWrongTime(new Date(1_000L));
        stat.setIsDeleted(0);
        return stat;
    }
}
