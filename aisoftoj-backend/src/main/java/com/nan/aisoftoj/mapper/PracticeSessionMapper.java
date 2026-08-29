package com.nan.aisoftoj.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nan.aisoftoj.dto.PracticeHistoryDTO;
import com.nan.aisoftoj.dto.PracticeHistorySummaryDTO;
import com.nan.aisoftoj.entity.PracticeSession;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper

public interface  PracticeSessionMapper extends BaseMapper<PracticeSession> {

    @Select("SELECT * FROM practice_session " +
            "WHERE id = #{sessionId} AND is_deleted = 0 " +
            "LIMIT 1 FOR UPDATE")
    PracticeSession selectByIdForUpdate(@Param("sessionId") Integer sessionId);

    @Select("SELECT * FROM practice_session " +
            "WHERE user_id IN (#{firstUserId}, #{secondUserId}) " +
            "AND is_deleted = 0 AND status IN (0, 1) " +
            "ORDER BY user_id, id FOR UPDATE")
    List<PracticeSession> selectForAccountMerge(
            @Param("firstUserId") Integer firstUserId,
            @Param("secondUserId") Integer secondUserId);

    @Update("UPDATE practice_session SET answered_count = (" +
            "SELECT COUNT(1) FROM practice_session_question_record " +
            "WHERE session_id = #{sessionId} AND is_deleted = 0 " +
            "AND user_answer IS NOT NULL AND user_answer <> ''" +
            ") WHERE id = #{sessionId} AND is_deleted = 0")
    int recalculateAnsweredCount(@Param("sessionId") Integer sessionId);

    @Select("SELECT " +
            "ps.id AS id, " +
            "ps.id AS sessionId, " +
            "p.name AS examName, " +
            "ps.exam_mode AS examMode, " +
            "CASE p.paper_cate_id " +
            "WHEN 1 THEN '综合知识' " +
            "WHEN 2 THEN '案例分析' " +
            "WHEN 3 THEN '论文' " +
            "ELSE '综合知识' END AS examType, " +
            "DATE_FORMAT(ps.create_time, '%Y-%m-%d %H:%i:%s') AS createTime, " +
            "ps.answered_count AS answeredCount, " +
            "p.question_total AS totalCount, " +
            "CASE ps.status WHEN 1 THEN 'completed' ELSE 'inProgress' END AS status " +
            "FROM practice_session ps " +
            "JOIN paper p ON p.id = ps.paper_id " +
            "WHERE ps.user_id = #{userId} AND ps.is_deleted = 0 AND ps.status IN (0, 1) " +
            "ORDER BY ps.create_time DESC, ps.id DESC " +
            "LIMIT #{pageSize} OFFSET #{offset}")
    List<PracticeHistoryDTO> selectPracticeHistoryByUserId(
            @Param("userId") Integer userId,
            @Param("pageSize") Integer pageSize,
            @Param("offset") Integer offset);

    @Select("SELECT COUNT(1) " +
            "FROM practice_session ps " +
            "WHERE ps.user_id = #{userId} AND ps.is_deleted = 0 AND ps.status IN (0, 1)")
    Long countPracticeHistoryByUserId(@Param("userId") Integer userId);

    @Select("SELECT " +
            "COUNT(1) AS totalCount, " +
            "COALESCE(SUM(CASE WHEN ps.status = 0 THEN 1 ELSE 0 END), 0) AS inProgressCount, " +
            "COALESCE(SUM(CASE WHEN ps.status = 1 THEN 1 ELSE 0 END), 0) AS completedCount, " +
            "COALESCE(SUM(COALESCE(ps.answered_count, 0)), 0) AS answeredCount " +
            "FROM practice_session ps " +
            "WHERE ps.user_id = #{userId} AND ps.is_deleted = 0 AND ps.status IN (0, 1)")
    PracticeHistorySummaryDTO selectPracticeHistorySummaryByUserId(@Param("userId") Integer userId);
}
