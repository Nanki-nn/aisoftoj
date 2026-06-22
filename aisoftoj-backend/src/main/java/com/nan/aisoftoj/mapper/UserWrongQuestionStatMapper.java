package com.nan.aisoftoj.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nan.aisoftoj.dto.WrongQuestionDTO;
import com.nan.aisoftoj.dto.recommendation.WrongQuestionEvidenceDTO;
import com.nan.aisoftoj.entity.UserWrongQuestionStat;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface UserWrongQuestionStatMapper extends BaseMapper<UserWrongQuestionStat> {

    @Select("SELECT " +
            "id, " +
            "(SELECT psqr.session_id " +
            "FROM practice_session_question_record psqr " +
            "JOIN practice_session ps ON ps.id = psqr.session_id " +
            "WHERE ps.user_id = user_wrong_question_stat.user_id " +
            "AND psqr.question_id = user_wrong_question_stat.question_id " +
            "AND psqr.is_correct = 0 " +
            "AND psqr.is_deleted = 0 " +
            "AND ps.is_deleted = 0 " +
            "ORDER BY psqr.update_time DESC, psqr.id DESC " +
            "LIMIT 1) AS sessionId, " +
            "question_id AS questionId, " +
            "question_name AS topicName, " +
            "paper_name AS questionBank, " +
            "topic_type AS topicType, " +
            "error_count AS errorCount, " +
            "DATE_FORMAT(last_wrong_time, '%Y-%m-%d %H:%i:%s') AS updateTime, " +
            "importance_level AS importance " +
            "FROM user_wrong_question_stat " +
            "WHERE user_id = #{userId} AND is_deleted = 0 " +
            "ORDER BY last_wrong_time DESC, id DESC " +
            "LIMIT #{pageSize} OFFSET #{offset}")
    List<WrongQuestionDTO> selectByUserId(
            @Param("userId") Integer userId,
            @Param("pageSize") Integer pageSize,
            @Param("offset") Integer offset);

    @Select("SELECT COUNT(1) " +
            "FROM user_wrong_question_stat " +
            "WHERE user_id = #{userId} AND is_deleted = 0")
    Long countByUserId(@Param("userId") Integer userId);

    @Select("SELECT " +
            "u.question_id AS questionId, " +
            "COALESCE(q.name, u.question_name) AS questionName, " +
            "COALESCE(q.category_name, u.question_name) AS knowledgePointName, " +
            "COALESCE(p.subject_name, q.subject_name) AS subjectName, " +
            "u.paper_name AS paperName, " +
            "u.topic_type AS questionType, " +
            "q.intro AS questionIntro, " +
            "q.options AS options, " +
            "q.analysis AS analysis, " +
            "COALESCE(q.difficulty, 2) AS difficulty, " +
            "COALESCE(p.paper_year, q.paper_year) AS paperYear, " +
            "u.error_count AS errorCount, " +
            "u.importance_level AS importanceLevel, " +
            "u.last_wrong_time AS lastWrongTime " +
            "FROM user_wrong_question_stat u " +
            "LEFT JOIN question q ON q.id = u.question_id AND q.is_deleted = 0 " +
            "LEFT JOIN paper p ON p.id = u.paper_id AND p.is_deleted = 0 " +
            "WHERE u.user_id = #{userId} AND u.is_deleted = 0 " +
            "ORDER BY u.last_wrong_time DESC, u.error_count DESC, u.id DESC")
    List<WrongQuestionEvidenceDTO> selectRecommendationEvidence(@Param("userId") Integer userId);
}
