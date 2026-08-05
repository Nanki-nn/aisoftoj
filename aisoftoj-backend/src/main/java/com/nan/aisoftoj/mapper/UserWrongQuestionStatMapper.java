package com.nan.aisoftoj.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nan.aisoftoj.dto.WrongQuestionDTO;
import com.nan.aisoftoj.dto.WrongQuestionSummaryDTO;
import com.nan.aisoftoj.entity.UserWrongQuestionStat;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface UserWrongQuestionStatMapper extends BaseMapper<UserWrongQuestionStat> {

    @Select("SELECT " +
            "id, " +
            "last_session_id AS sessionId, " +
            "question_id AS questionId, " +
            "question_name AS topicName, " +
            "paper_name AS questionBank, " +
            "topic_type AS topicType, " +
            "error_count AS errorCount, " +
            "DATE_FORMAT(last_wrong_time, '%Y-%m-%d %H:%i:%s') AS updateTime, " +
            "importance_level AS importance " +
            "FROM user_wrong_question_stat " +
            "WHERE user_id = #{userId} AND is_deleted = 0 " +
            "ORDER BY error_count DESC, last_wrong_time DESC, id DESC " +
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
            "COUNT(1) AS totalCount, " +
            "COALESCE(SUM(CASE WHEN importance_level = 'high' THEN 1 ELSE 0 END), 0) AS masterCount, " +
            "COALESCE(SUM(CASE WHEN error_count >= 2 THEN 1 ELSE 0 END), 0) AS frequentCount, " +
            "COUNT(DISTINCT paper_name) AS paperCount " +
            "FROM user_wrong_question_stat " +
            "WHERE user_id = #{userId} AND is_deleted = 0")
    WrongQuestionSummaryDTO selectSummaryByUserId(@Param("userId") Integer userId);

    @Insert("INSERT INTO user_wrong_question_stat (" +
            "source_front_id, source_type, user_id, paper_id, question_id, " +
            "question_name, paper_name, topic_type, error_count, importance_level, " +
            "last_wrong_time, last_session_id, is_deleted" +
            ") VALUES (" +
            "#{sourceFrontId}, #{sourceType}, #{userId}, #{paperId}, #{questionId}, " +
            "#{questionName}, #{paperName}, #{topicType}, #{errorCount}, #{importanceLevel}, " +
            "#{lastWrongTime}, #{lastSessionId}, #{isDeleted}" +
            ") ON DUPLICATE KEY UPDATE " +
            "paper_id = CASE " +
            "WHEN last_wrong_time IS NULL OR VALUES(last_wrong_time) > last_wrong_time " +
            "OR (VALUES(last_wrong_time) = last_wrong_time " +
            "AND VALUES(last_session_id) > COALESCE(last_session_id, 0)) " +
            "THEN VALUES(paper_id) ELSE paper_id END, " +
            "question_name = CASE " +
            "WHEN last_wrong_time IS NULL OR VALUES(last_wrong_time) > last_wrong_time " +
            "OR (VALUES(last_wrong_time) = last_wrong_time " +
            "AND VALUES(last_session_id) > COALESCE(last_session_id, 0)) " +
            "THEN VALUES(question_name) ELSE question_name END, " +
            "paper_name = CASE " +
            "WHEN last_wrong_time IS NULL OR VALUES(last_wrong_time) > last_wrong_time " +
            "OR (VALUES(last_wrong_time) = last_wrong_time " +
            "AND VALUES(last_session_id) > COALESCE(last_session_id, 0)) " +
            "THEN COALESCE(VALUES(paper_name), paper_name) ELSE paper_name END, " +
            "topic_type = CASE " +
            "WHEN last_wrong_time IS NULL OR VALUES(last_wrong_time) > last_wrong_time " +
            "OR (VALUES(last_wrong_time) = last_wrong_time " +
            "AND VALUES(last_session_id) > COALESCE(last_session_id, 0)) " +
            "THEN VALUES(topic_type) ELSE topic_type END, " +
            "error_count = error_count + 1, " +
            "importance_level = CASE " +
            "WHEN FIELD(VALUES(importance_level), 'low', 'medium', 'high', 'must') " +
            "> FIELD(importance_level, 'low', 'medium', 'high', 'must') " +
            "THEN VALUES(importance_level) ELSE importance_level END, " +
            "last_session_id = CASE " +
            "WHEN last_wrong_time IS NULL OR VALUES(last_wrong_time) > last_wrong_time " +
            "THEN VALUES(last_session_id) " +
            "WHEN VALUES(last_wrong_time) = last_wrong_time " +
            "THEN GREATEST(COALESCE(last_session_id, 0), COALESCE(VALUES(last_session_id), 0)) " +
            "ELSE last_session_id END, " +
            "last_wrong_time = CASE " +
            "WHEN last_wrong_time IS NULL OR VALUES(last_wrong_time) > last_wrong_time " +
            "THEN VALUES(last_wrong_time) ELSE last_wrong_time END, " +
            "is_deleted = 0")
    int upsertActiveWrongQuestion(UserWrongQuestionStat stat);
}
