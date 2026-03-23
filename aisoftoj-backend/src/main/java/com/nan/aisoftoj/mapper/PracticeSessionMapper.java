package com.nan.aisoftoj.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nan.aisoftoj.dto.PracticeHistoryDTO;
import com.nan.aisoftoj.entity.PracticeSession;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper

public interface  PracticeSessionMapper extends BaseMapper<PracticeSession> {

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
            "WHERE ps.user_id = #{userId} AND ps.is_deleted = 0 " +
            "ORDER BY ps.create_time DESC, ps.id DESC")
    List<PracticeHistoryDTO> selectPracticeHistoryByUserId(Integer userId);
}
