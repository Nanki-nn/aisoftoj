package com.nan.aisoftoj.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nan.aisoftoj.entity.AuthEmailCode;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

@Mapper
public interface AuthEmailCodeMapper extends BaseMapper<AuthEmailCode> {
    @Select("SELECT * FROM auth_email_code " +
            "WHERE email = #{email} AND scene = #{scene} AND status = 'ACTIVE' " +
            "AND failed_attempts < #{maxAttempts} AND expires_at > #{now} " +
            "ORDER BY id DESC LIMIT 1 FOR UPDATE")
    AuthEmailCode selectLatestActiveForUpdate(
            @Param("email") String email,
            @Param("scene") String scene,
            @Param("maxAttempts") int maxAttempts,
            @Param("now") LocalDateTime now);

    @Update("UPDATE auth_email_code SET status = 'CONSUMED', consumed_at = #{now} " +
            "WHERE id = #{id} AND status = 'ACTIVE' AND failed_attempts < #{maxAttempts} " +
            "AND expires_at > #{now}")
    int consumeActive(
            @Param("id") Long id,
            @Param("maxAttempts") int maxAttempts,
            @Param("now") LocalDateTime now);

    @Update("UPDATE auth_email_code SET failed_attempts = failed_attempts + 1, " +
            "status = CASE WHEN failed_attempts + 1 >= #{maxAttempts} THEN 'FAILED' ELSE status END " +
            "WHERE id = #{id} AND status = 'ACTIVE' AND failed_attempts < #{maxAttempts} " +
            "AND expires_at > #{now}")
    int recordFailure(
            @Param("id") Long id,
            @Param("maxAttempts") int maxAttempts,
            @Param("now") LocalDateTime now);

    @Update("UPDATE auth_email_code SET status = 'SUPERSEDED' " +
            "WHERE email = #{email} AND scene = #{scene} AND status = 'ACTIVE' AND id <> #{currentId}")
    int supersedeOtherActive(
            @Param("email") String email,
            @Param("scene") String scene,
            @Param("currentId") Long currentId);

    @Update("UPDATE auth_email_code SET status = 'ACTIVE', activated_at = NOW(), " +
            "expires_at = DATE_ADD(NOW(), INTERVAL #{expiresMinutes} MINUTE) " +
            "WHERE id = #{id} AND status = 'PENDING'")
    int activate(
            @Param("id") Long id,
            @Param("expiresMinutes") int expiresMinutes);

    @Update("UPDATE auth_email_code SET status = 'FAILED' WHERE id = #{id} AND status = 'PENDING'")
    int failPending(@Param("id") Long id);

    @Delete("DELETE FROM auth_email_code WHERE create_time < #{cutoff}")
    int deleteCreatedBefore(@Param("cutoff") LocalDateTime cutoff);
}
