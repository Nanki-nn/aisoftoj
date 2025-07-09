package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("user_favorite")
public class UserFavorite {
    @TableId
    private Long id;
    private Long userId;
    private Long questionId;
    private java.time.LocalDateTime createTime;
} 