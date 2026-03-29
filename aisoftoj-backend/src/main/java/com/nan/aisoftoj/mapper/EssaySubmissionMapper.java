package com.nan.aisoftoj.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nan.aisoftoj.entity.EssaySubmission;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface EssaySubmissionMapper extends BaseMapper<EssaySubmission> {

    /**
     * 查询用户今日提交数量
     */
    int countTodayByUser(@Param("userId") Long userId);
}
