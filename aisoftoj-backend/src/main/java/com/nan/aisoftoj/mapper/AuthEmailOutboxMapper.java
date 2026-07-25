package com.nan.aisoftoj.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nan.aisoftoj.entity.AuthEmailOutbox;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

@Mapper
public interface AuthEmailOutboxMapper extends BaseMapper<AuthEmailOutbox> {
    @Select("SELECT id FROM auth_email_outbox " +
            "WHERE status = 'PENDING' AND next_attempt_at <= #{now} ORDER BY id ASC LIMIT 1")
    Long selectNextPendingId(@Param("now") LocalDateTime now);

    @Update("UPDATE auth_email_outbox SET status = 'SENDING', locked_at = #{now}, " +
            "attempt_count = attempt_count + 1 WHERE id = #{id} AND status = 'PENDING'")
    int claimPending(@Param("id") Long id, @Param("now") LocalDateTime now);

    @Update("UPDATE auth_email_outbox SET status = 'PENDING', locked_at = NULL, next_attempt_at = #{now}, " +
            "last_error = 'worker-timeout' WHERE status = 'SENDING' AND locked_at < #{staleBefore}")
    int releaseStaleClaims(
            @Param("staleBefore") LocalDateTime staleBefore,
            @Param("now") LocalDateTime now);

    @Delete("DELETE FROM auth_email_outbox WHERE update_time < #{cutoff} AND status IN ('SENT', 'FAILED')")
    int deleteTerminalBefore(@Param("cutoff") LocalDateTime cutoff);
}
