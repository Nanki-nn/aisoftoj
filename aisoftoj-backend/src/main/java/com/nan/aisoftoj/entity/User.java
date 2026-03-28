package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;

import java.util.Date;

@Data
public class User {
    @TableId(type = IdType.AUTO)
    private Integer id;

    private String wxOpenId;

    private String phone;

    private String email;

    private String loginName;

    private String nickName;

    private String avatar;

    private String password;

    private Boolean isEnabled;

    private Boolean isDeleted;

    private Date createTime;

    private Date updateTime;
}
