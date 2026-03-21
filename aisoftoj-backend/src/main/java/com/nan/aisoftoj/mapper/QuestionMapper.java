package com.nan.aisoftoj.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nan.aisoftoj.entity.Question;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface QuestionMapper extends BaseMapper<Question> {

    @Select("SELECT t1.* FROM question t1 " +
            "JOIN paper_question_relation t2 ON t1.id = t2.question_id " +
            "WHERE t2.paper_id = #{paperId}")
    List<Question> selectQuestionsByPaperId(Integer paperId);
}