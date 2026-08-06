package com.nan.aisoftoj.service.impl;

import cn.hutool.core.util.StrUtil;
import com.nan.aisoftoj.auth.EmailCodeScene;
import com.nan.aisoftoj.auth.EmailNormalizer;
import com.nan.aisoftoj.common.ConflictException;
import com.nan.aisoftoj.common.InvalidEmailCodeException;
import com.nan.aisoftoj.common.UserRole;
import com.nan.aisoftoj.consts.PracticeSessionState;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.entity.User;
import com.nan.aisoftoj.entity.UserWrongQuestionStat;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.PracticeSessionQuestionRecordMapper;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import com.nan.aisoftoj.service.EmailCodeService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
public class EmailBindingService {
    private final UserMapper userMapper;
    private final EmailCodeService emailCodeService;
    private final PracticeSessionMapper practiceSessionMapper;
    private final PracticeSessionQuestionRecordMapper questionRecordMapper;
    private final UserWrongQuestionStatMapper wrongQuestionMapper;

    public EmailBindingService(
            UserMapper userMapper,
            EmailCodeService emailCodeService,
            PracticeSessionMapper practiceSessionMapper,
            PracticeSessionQuestionRecordMapper questionRecordMapper,
            UserWrongQuestionStatMapper wrongQuestionMapper) {
        this.userMapper = userMapper;
        this.emailCodeService = emailCodeService;
        this.practiceSessionMapper = practiceSessionMapper;
        this.questionRecordMapper = questionRecordMapper;
        this.wrongQuestionMapper = wrongQuestionMapper;
    }

    @Transactional(
            rollbackFor = Exception.class,
            noRollbackFor = InvalidEmailCodeException.class)
    public User bind(Integer currentUserId, String email, String code) {
        String normalizedEmail = EmailNormalizer.normalize(email);
        User observedCurrent = userMapper.selectById(currentUserId);
        requireActiveWechatUser(observedCurrent);

        if (isSameVerifiedEmail(observedCurrent, normalizedEmail)) {
            User current = userMapper.selectByIdForUpdate(currentUserId);
            requireActiveWechatUser(current);
            if (isSameVerifiedEmail(current, normalizedEmail)) {
                return current;
            }
            throw new ConflictException("当前微信账号状态已变化，请重新登录");
        }
        if (hasEmail(observedCurrent)) {
            throw new ConflictException("当前微信账号已经绑定邮箱");
        }

        User observedExisting = userMapper.selectAnyByNormalizedEmail(normalizedEmail);
        if (observedExisting == null) {
            return bindNewEmail(currentUserId, normalizedEmail, code);
        }
        return mergeExistingAccount(currentUserId, observedExisting.getId(), normalizedEmail, code);
    }

    private User bindNewEmail(Integer currentUserId, String normalizedEmail, String code) {
        User current = userMapper.selectByIdForUpdate(currentUserId);
        requireActiveWechatUser(current);
        if (isSameVerifiedEmail(current, normalizedEmail)) {
            return current;
        }
        if (hasEmail(current)) {
            throw new ConflictException("当前微信账号已经绑定邮箱");
        }
        User existing = userMapper.selectAnyByNormalizedEmailForUpdate(normalizedEmail);
        if (existing != null) {
            throw new ConflictException("该邮箱账号状态已变化，请重新提交绑定");
        }
        emailCodeService.consumeCode(normalizedEmail, EmailCodeScene.BIND_EMAIL, code);

        current.setEmail(normalizedEmail);
        current.setEmailNormalized(normalizedEmail);
        current.setEmailVerifiedAt(new Date());
        try {
            if (userMapper.updateById(current) != 1) {
                throw new IllegalStateException("绑定邮箱失败");
            }
        } catch (DuplicateKeyException ex) {
            throw new ConflictException("该邮箱已关联账号，需完成账号合并");
        }
        return current;
    }

    private User mergeExistingAccount(
            Integer currentUserId,
            Integer targetUserId,
            String normalizedEmail,
            String code) {
        int firstUserId = Math.min(currentUserId, targetUserId);
        int secondUserId = Math.max(currentUserId, targetUserId);
        List<User> lockedUsers = userMapper.selectPairForUpdate(firstUserId, secondUserId);
        User current = findUser(lockedUsers, currentUserId);
        User target = findUser(lockedUsers, targetUserId);
        requireActiveWechatUser(current);
        if (hasEmail(current)) {
            throw new ConflictException("当前微信账号已经绑定邮箱");
        }

        User emailOwner = userMapper.selectAnyByNormalizedEmailForUpdate(normalizedEmail);
        if (emailOwner == null || !targetUserId.equals(emailOwner.getId())) {
            throw new ConflictException("该邮箱账号状态已变化，请重新提交绑定");
        }
        requireMergeTarget(target, normalizedEmail, current.getWxOpenId());

        emailCodeService.consumeCode(normalizedEmail, EmailCodeScene.BIND_EMAIL, code);
        List<PracticeSession> sessions = practiceSessionMapper.selectForAccountMerge(
                firstUserId, secondUserId);
        Map<Integer, Integer> mergedSessionIds = migrateSessions(
                sessions, currentUserId, targetUserId);
        List<UserWrongQuestionStat> wrongQuestions = wrongQuestionMapper.selectForAccountMerge(
                firstUserId, secondUserId);
        migrateWrongQuestions(wrongQuestions, currentUserId, targetUserId, mergedSessionIds);

        String openId = current.getWxOpenId();
        current.setWxOpenId(null);
        current.setTokenVersion(currentTokenVersion(current) + 1);
        current.setIsDeleted(true);
        requireSingleUpdate(userMapper.updateById(current), "临时账号失效失败");

        target.setWxOpenId(openId);
        requireSingleUpdate(userMapper.updateById(target), "微信身份迁移失败");
        return target;
    }

    private Map<Integer, Integer> migrateSessions(
            List<PracticeSession> sessions,
            Integer sourceUserId,
            Integer targetUserId) {
        Map<String, PracticeSession> targetActiveSessions = new HashMap<>();
        for (PracticeSession session : sessions) {
            if (targetUserId.equals(session.getUserId()) && isDoing(session)) {
                targetActiveSessions.put(sessionKey(session), session);
            }
        }

        Map<Integer, Integer> mergedSessionIds = new HashMap<>();
        for (PracticeSession session : sessions) {
            if (!sourceUserId.equals(session.getUserId())) {
                continue;
            }
            if (session.getStatus() != null
                    && session.getStatus() == PracticeSessionState.FINISHED.getCode()) {
                session.setUserId(targetUserId);
                requireSingleUpdate(practiceSessionMapper.updateById(session), "已完成会话迁移失败");
                continue;
            }
            if (!isDoing(session)) {
                continue;
            }

            PracticeSession targetSession = targetActiveSessions.get(sessionKey(session));
            if (targetSession == null) {
                session.setUserId(targetUserId);
                requireSingleUpdate(practiceSessionMapper.updateById(session), "活动会话迁移失败");
                targetActiveSessions.put(sessionKey(session), session);
                continue;
            }

            questionRecordMapper.copyIntoBlankAnswers(session.getId(), targetSession.getId());
            requireSingleUpdate(
                    practiceSessionMapper.recalculateAnsweredCount(targetSession.getId()),
                    "活动会话进度合并失败");
            session.setStatus(PracticeSessionState.MERGED.getCode());
            session.setMergedIntoSessionId(targetSession.getId());
            requireSingleUpdate(practiceSessionMapper.updateById(session), "冲突会话归档失败");
            mergedSessionIds.put(session.getId(), targetSession.getId());
        }
        return mergedSessionIds;
    }

    private void migrateWrongQuestions(
            List<UserWrongQuestionStat> rows,
            Integer sourceUserId,
            Integer targetUserId,
            Map<Integer, Integer> mergedSessionIds) {
        Map<Integer, UserWrongQuestionStat> targetByQuestion = new HashMap<>();
        for (UserWrongQuestionStat row : rows) {
            if (targetUserId.equals(row.getUserId()) && row.getQuestionId() != null) {
                targetByQuestion.put(row.getQuestionId(), row);
            }
        }

        for (UserWrongQuestionStat source : rows) {
            if (!sourceUserId.equals(source.getUserId())) {
                continue;
            }
            source.setLastSessionId(remapSessionId(source.getLastSessionId(), mergedSessionIds));
            UserWrongQuestionStat target = source.getQuestionId() == null
                    ? null
                    : targetByQuestion.get(source.getQuestionId());
            if (target == null) {
                source.setUserId(targetUserId);
                requireSingleUpdate(wrongQuestionMapper.updateById(source), "错题迁移失败");
                if (source.getQuestionId() != null) {
                    targetByQuestion.put(source.getQuestionId(), source);
                }
                continue;
            }

            target.setLastSessionId(remapSessionId(target.getLastSessionId(), mergedSessionIds));
            mergeWrongQuestion(target, source);
            source.setIsDeleted(1);
            requireSingleUpdate(wrongQuestionMapper.updateById(source), "重复错题归档失败");
            requireSingleUpdate(wrongQuestionMapper.updateById(target), "错题聚合失败");
        }
    }

    private void mergeWrongQuestion(UserWrongQuestionStat target, UserWrongQuestionStat source) {
        UserWrongQuestionStat displayWinner = newerWrongQuestion(target, source);
        target.setErrorCount(valueOrZero(target.getErrorCount()) + valueOrZero(source.getErrorCount()));
        target.setImportanceLevel(higherImportance(
                target.getImportanceLevel(), source.getImportanceLevel()));
        target.setLastWrongTime(later(target.getLastWrongTime(), source.getLastWrongTime()));
        target.setLastSessionId(displayWinner.getLastSessionId());
        if (displayWinner == source) {
            target.setPaperId(source.getPaperId());
            target.setQuestionName(source.getQuestionName());
            target.setPaperName(source.getPaperName());
            target.setTopicType(source.getTopicType());
            target.setSourceType(source.getSourceType());
        }
    }

    private UserWrongQuestionStat newerWrongQuestion(
            UserWrongQuestionStat first,
            UserWrongQuestionStat second) {
        Date firstTime = first.getLastWrongTime();
        Date secondTime = second.getLastWrongTime();
        if (firstTime == null && secondTime != null) {
            return second;
        }
        if (firstTime != null && secondTime == null) {
            return first;
        }
        if (firstTime != null && secondTime != null) {
            int comparison = firstTime.compareTo(secondTime);
            if (comparison != 0) {
                return comparison > 0 ? first : second;
            }
        }
        return first.getId() <= second.getId() ? first : second;
    }

    private Date later(Date first, Date second) {
        if (first == null) {
            return second;
        }
        if (second == null) {
            return first;
        }
        return first.after(second) ? first : second;
    }

    private String higherImportance(String first, String second) {
        return importanceRank(first) >= importanceRank(second) ? first : second;
    }

    private int importanceRank(String importance) {
        if ("must".equals(importance)) {
            return 4;
        }
        if ("high".equals(importance)) {
            return 3;
        }
        if ("medium".equals(importance)) {
            return 2;
        }
        return 1;
    }

    private Integer remapSessionId(Integer sessionId, Map<Integer, Integer> mergedSessionIds) {
        return sessionId == null ? null : mergedSessionIds.getOrDefault(sessionId, sessionId);
    }

    private User findUser(List<User> users, Integer userId) {
        for (User user : users) {
            if (userId.equals(user.getId())) {
                return user;
            }
        }
        return null;
    }

    private void requireMergeTarget(User user, String normalizedEmail, String currentOpenId) {
        if (user == null
                || Boolean.TRUE.equals(user.getIsDeleted())
                || !Boolean.TRUE.equals(user.getIsEnabled())
                || !UserRole.USER.name().equals(user.getRole())
                || user.getEmailVerifiedAt() == null
                || !normalizedEmail.equals(user.getEmailNormalized())) {
            throw new InvalidEmailCodeException();
        }
        if (StrUtil.isNotBlank(user.getWxOpenId())
                && !Objects.equals(user.getWxOpenId(), currentOpenId)) {
            throw new ConflictException("该邮箱账号已绑定其他微信身份");
        }
    }

    private boolean isDoing(PracticeSession session) {
        return session.getStatus() != null
                && session.getStatus() == PracticeSessionState.DOING.getCode();
    }

    private String sessionKey(PracticeSession session) {
        return session.getPaperId() + ":"
                + String.valueOf(session.getExamMode()).toLowerCase(Locale.ROOT);
    }

    private boolean isSameVerifiedEmail(User user, String normalizedEmail) {
        return normalizedEmail.equals(user.getEmailNormalized()) && user.getEmailVerifiedAt() != null;
    }

    private boolean hasEmail(User user) {
        return StrUtil.isNotBlank(user.getEmail()) || StrUtil.isNotBlank(user.getEmailNormalized());
    }

    private int currentTokenVersion(User user) {
        return user.getTokenVersion() == null ? 0 : user.getTokenVersion();
    }

    private int valueOrZero(Integer value) {
        return value == null ? 0 : value;
    }

    private void requireSingleUpdate(int updated, String message) {
        if (updated != 1) {
            throw new IllegalStateException(message);
        }
    }

    private void requireActiveWechatUser(User user) {
        if (user == null
                || Boolean.TRUE.equals(user.getIsDeleted())
                || !Boolean.TRUE.equals(user.getIsEnabled())
                || !UserRole.USER.name().equals(user.getRole())
                || StrUtil.isBlank(user.getWxOpenId())) {
            throw new IllegalArgumentException("当前账号不支持邮箱绑定");
        }
    }
}
