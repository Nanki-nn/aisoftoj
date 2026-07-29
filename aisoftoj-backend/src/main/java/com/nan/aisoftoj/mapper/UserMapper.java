package com.nan.aisoftoj.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nan.aisoftoj.entity.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.Date;

@Mapper
public interface UserMapper extends BaseMapper<User> {
    @Select("SELECT * FROM user WHERE email_normalized = #{email} AND is_deleted = 0 LIMIT 1")
    User selectByNormalizedEmail(@Param("email") String email);

    @Select("SELECT * FROM user WHERE email_normalized = #{email} LIMIT 1")
    User selectAnyByNormalizedEmail(@Param("email") String email);

    @Select("SELECT * FROM user WHERE email_normalized = #{email} AND is_deleted = 0 LIMIT 1 FOR UPDATE")
    User selectByNormalizedEmailForUpdate(@Param("email") String email);

    @Update("UPDATE `user` SET last_login_time = #{lastLoginTime} WHERE id = #{userId} AND is_deleted = 0")
    int updateLastLoginTime(@Param("userId") Integer userId, @Param("lastLoginTime") Date lastLoginTime);
}
