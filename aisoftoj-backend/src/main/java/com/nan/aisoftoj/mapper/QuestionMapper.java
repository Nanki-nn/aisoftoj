package com.nan.aisoftoj.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nan.aisoftoj.entity.Question;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface QuestionMapper extends BaseMapper<Question> {

    @Select("SELECT t1.* FROM question t1 " +
            "JOIN paper_question_relation t2 ON t1.id = t2.question_id " +
            "WHERE t2.paper_id = #{paperId}")
    List<Question> selectQuestionsByPaperId(Integer paperId);

    @Select("SELECT q.id, q.name, q.intro, " +
            "MAX(p.paper_year) AS year, MAX(p.subject_name) AS subjectName " +
            "FROM question q " +
            "LEFT JOIN paper_question_relation pqr ON q.id = pqr.question_id " +
            "LEFT JOIN paper p ON pqr.paper_id = p.id " +
            "WHERE q.question_type = 6 AND q.is_deleted = 0 " +
            "GROUP BY q.id, q.name, q.intro " +
            "ORDER BY MAX(p.paper_year) DESC")
    List<Map<String, Object>> selectEssayQuestionsWithPaper();
}