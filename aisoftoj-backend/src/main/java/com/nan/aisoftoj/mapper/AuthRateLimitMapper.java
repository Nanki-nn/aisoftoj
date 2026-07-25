package com.nan.aisoftoj.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nan.aisoftoj.entity.AuthRateLimit;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

@Mapper
public interface AuthRateLimitMapper extends BaseMapper<AuthRateLimit> {
    @Insert("INSERT IGNORE INTO auth_rate_limit " +
            "(limit_key, counter, window_start, expires_at, update_time) " +
            "VALUES (#{limitKey}, 0, #{now}, #{expiresAt}, #{now})")
    int insertIgnore(
            @Param("limitKey") String limitKey,
            @Param("now") LocalDateTime now,
            @Param("expiresAt") LocalDateTime expiresAt);

    @Select("SELECT * FROM auth_rate_limit WHERE limit_key = #{limitKey} FOR UPDATE")
    AuthRateLimit selectForUpdate(@Param("limitKey") String limitKey);

    @Update("UPDATE auth_rate_limit SET counter = #{counter}, window_start = #{windowStart}, " +
            "expires_at = #{expiresAt}, update_time = #{now} WHERE limit_key = #{limitKey}")
    int updateWindow(
            @Param("limitKey") String limitKey,
            @Param("counter") int counter,
            @Param("windowStart") LocalDateTime windowStart,
            @Param("expiresAt") LocalDateTime expiresAt,
            @Param("now") LocalDateTime now);

    @Delete("DELETE FROM auth_rate_limit WHERE expires_at < #{cutoff}")
    int deleteExpiredBefore(@Param("cutoff") LocalDateTime cutoff);
}
