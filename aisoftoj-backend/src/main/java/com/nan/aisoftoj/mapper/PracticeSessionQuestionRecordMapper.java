package com.nan.aisoftoj.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nan.aisoftoj.entity.PracticeSessionQuestionRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface PracticeSessionQuestionRecordMapper extends BaseMapper<PracticeSessionQuestionRecord> {

    @Select("SELECT * FROM practice_session_question_record " +
            "WHERE session_id = #{sessionId} AND is_deleted = 0 " +
            "ORDER BY question_order, id")
    List<PracticeSessionQuestionRecord> selectBySessionIdOrdered(@Param("sessionId") Integer sessionId);

    @Select("SELECT * FROM practice_session_question_record " +
            "WHERE id = #{recordId} AND is_deleted = 0 " +
            "LIMIT 1 FOR UPDATE")
    PracticeSessionQuestionRecord selectByIdForUpdate(@Param("recordId") Integer recordId);

    @Update("UPDATE practice_session_question_record " +
            "SET user_answer = #{userAnswer}, spend_time = #{spendTime}, " +
            "is_submitted = 0, is_correct = NULL, " +
            "answer_revision = answer_revision + 1, last_mutation_id = #{mutationId} " +
            "WHERE id = #{recordId} AND answer_revision = #{expectedRevision} " +
            "AND confirmed_at IS NULL AND is_deleted = 0")
    int updateDraftWithRevision(
            @Param("recordId") Integer recordId,
            @Param("userAnswer") String userAnswer,
            @Param("spendTime") Integer spendTime,
            @Param("expectedRevision") Long expectedRevision,
            @Param("mutationId") String mutationId);

}
