package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("user")
public class User {
    @TableId
    private Long id;
    private String username;
    private String password;
    private String email;
    private String phone;
    private String avatar;
    private String nickname;
    private Integer role; // 0: 普通用户, 1: 管理员
} 