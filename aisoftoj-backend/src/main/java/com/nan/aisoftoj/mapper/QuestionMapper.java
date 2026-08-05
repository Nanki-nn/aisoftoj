package com.nan.aisoftoj.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nan.aisoftoj.dto.SessionQuestionSnapshot;
import com.nan.aisoftoj.entity.Question;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface QuestionMapper extends BaseMapper<Question> {

    @Select("SELECT t1.* FROM question t1 " +
            "JOIN paper_question_relation t2 ON t1.id = t2.question_id " +
            "WHERE t2.paper_id = #{paperId} AND t1.is_deleted = 0 " +
            "ORDER BY t2.order_num, t2.id " +
            "LIMIT 201")
    List<Question> selectQuestionsByPaperId(Integer paperId);

    @Select("SELECT pqr.id AS paperQuestionRelationId, q.id AS questionId, " +
            "pqr.order_num AS questionOrder, pqr.score AS scoreSnapshot, " +
            "q.grading_strategy AS gradingStrategySnapshot, " +
            "q.name, q.intro, q.options, q.answer, q.analysis, q.question_type AS questionType, q.difficulty " +
            "FROM paper_question_relation pqr " +
            "JOIN question q ON q.id = pqr.question_id " +
            "WHERE pqr.paper_id = #{paperId} AND q.is_deleted = 0 " +
            "ORDER BY pqr.order_num, pqr.id LIMIT 201")
    List<SessionQuestionSnapshot> selectSessionQuestionSnapshotsByPaperId(Integer paperId);

    @Select("SELECT psqr.paper_question_relation_id AS paperQuestionRelationId, " +
            "psqr.question_id AS questionId, psqr.question_order AS questionOrder, " +
            "psqr.score_snapshot AS scoreSnapshot, " +
            "psqr.grading_strategy_snapshot AS gradingStrategySnapshot, " +
            "q.name, q.intro, q.options, q.answer, q.analysis, q.question_type AS questionType, q.difficulty, " +
            "psqr.id AS questionRecordId, psqr.user_answer AS userAnswer, " +
            "psqr.is_submitted AS isSubmitted, psqr.is_correct AS isCorrect, " +
            "psqr.spend_time AS spendTime, psqr.answer_revision AS answerRevision, " +
            "psqr.confirmed_at AS confirmedAt " +
            "FROM practice_session_question_record psqr " +
            "JOIN question q ON q.id = psqr.question_id " +
            "WHERE psqr.session_id = #{sessionId} AND psqr.is_deleted = 0 " +
            "ORDER BY psqr.question_order, psqr.id LIMIT 201")
    List<SessionQuestionSnapshot> selectSessionQuestionSnapshotsBySessionId(Integer sessionId);

    @Select("SELECT COUNT(1) FROM question q " +
            "JOIN paper_question_relation pqr ON q.id = pqr.question_id " +
            "JOIN paper p ON pqr.paper_id = p.id " +
            "WHERE q.id = #{questionId} AND q.is_deleted = 0 " +
            "AND p.is_deleted = 0 AND p.publish_status = 1")
    int countPublishedPaperRelations(@Param("questionId") Integer questionId);

    @Select("SELECT COUNT(1) FROM practice_session_question_record " +
            "WHERE question_id = #{questionId} AND is_deleted = 0")
    int countSessionQuestionRecords(@Param("questionId") Integer questionId);

    @Select("SELECT q.id, q.name, q.intro, " +
            "MAX(p.paper_year) AS year, MAX(p.subject_name) AS subjectName " +
            "FROM question q " +
            "LEFT JOIN paper_question_relation pqr ON q.id = pqr.question_id " +
            "LEFT JOIN paper p ON pqr.paper_id = p.id " +
            "WHERE q.question_type = 6 AND q.is_deleted = 0 " +
            "GROUP BY q.id, q.name, q.intro " +
            "ORDER BY MAX(p.paper_year) DESC " +
            "LIMIT 201")
    List<Map<String, Object>> selectEssayQuestionsWithPaper();

    /**
     * 查询题目关联的最新试卷的科目和年份（用于 admin 列表展示）
     * 返回 Map: questionId -> {subjectName, paperYear}
     */
    @Select("SELECT q.id AS questionId, " +
            "MAX(p.subject_name) AS subjectName, " +
            "MAX(p.paper_year) AS paperYear, " +
            "MAX(p.paper_month) AS paperMonth, " +
            "MAX(p.paper_cate_id) AS paperCateId " +
            "FROM question q " +
            "LEFT JOIN paper_question_relation pqr ON q.id = pqr.question_id " +
            "LEFT JOIN paper p ON pqr.paper_id = p.id AND p.is_deleted = 0 " +
            "WHERE q.id IN (${questionIds}) " +
            "GROUP BY q.id")
    List<Map<String, Object>> selectPaperInfoByQuestionIds(@Param("questionIds") String questionIds);

    /**
     * 根据科目名称和年份查询关联的题目 ID 列表
     */
    @Select("<script>" +
            "SELECT DISTINCT pqr.question_id FROM paper_question_relation pqr " +
            "JOIN paper p ON pqr.paper_id = p.id AND p.is_deleted = 0 " +
            "WHERE 1=1 " +
            "<if test='subjectName != null and subjectName != \"\"'>" +
            "  AND p.subject_name = #{subjectName} " +
            "</if>" +
            "<if test='year != null'>" +
            "  AND p.paper_year = #{year} " +
            "</if>" +
            "<if test='month != null'>" +
            "  AND p.paper_month = #{month} " +
            "</if>" +
            "<if test='paperCateId != null'>" +
            "  AND p.paper_cate_id = #{paperCateId} " +
            "</if>" +
            "</script>")
    List<Integer> selectQuestionIdsByPaperFilter(@Param("subjectName") String subjectName,
                                                  @Param("year") Integer year,
                                                  @Param("month") Integer month,
                                                  @Param("paperCateId") Integer paperCateId);

    /** 查询所有不重复的科目名称（用于前端筛选下拉） */
    @Select("SELECT DISTINCT p.subject_name FROM paper p WHERE p.is_deleted = 0 AND p.subject_name IS NOT NULL ORDER BY p.subject_name")
    List<String> selectDistinctSubjectNames();

    /** 查询所有不重复的年份（用于前端筛选下拉） */
    @Select("SELECT DISTINCT p.paper_year FROM paper p WHERE p.is_deleted = 0 AND p.paper_year IS NOT NULL ORDER BY p.paper_year DESC")
    List<Integer> selectDistinctPaperYears();

    /** 查询所有不重复的月份（用于前端筛选下拉） */
    @Select("SELECT DISTINCT p.paper_month FROM paper p WHERE p.is_deleted = 0 AND p.paper_month IS NOT NULL ORDER BY p.paper_month")
    List<Integer> selectDistinctPaperMonths();
}
