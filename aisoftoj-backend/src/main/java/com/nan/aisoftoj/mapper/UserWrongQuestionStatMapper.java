package com.nan.aisoftoj.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nan.aisoftoj.dto.WrongQuestionDTO;
import com.nan.aisoftoj.entity.UserWrongQuestionStat;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface UserWrongQuestionStatMapper extends BaseMapper<UserWrongQuestionStat> {

    @Select("SELECT " +
            "id, " +
            "question_name AS topicName, " +
            "paper_name AS questionBank, " +
            "topic_type AS topicType, " +
            "error_count AS errorCount, " +
            "DATE_FORMAT(last_wrong_time, '%Y-%m-%d %H:%i:%s') AS updateTime, " +
            "importance_level AS importance " +
            "FROM user_wrong_question_stat " +
            "WHERE user_id = #{userId} AND is_deleted = 0 " +
            "ORDER BY last_wrong_time DESC, id DESC")
    List<WrongQuestionDTO> selectByUserId(Integer userId);
}
