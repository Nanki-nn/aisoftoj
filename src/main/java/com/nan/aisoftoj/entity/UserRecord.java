package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("user_record")
public class UserRecord {
    @TableId
    private Long id;
    private Long userId;
    private Long questionId;
    private String userAnswer;
    private Boolean isCorrect;
    private java.time.LocalDateTime answerTime;
} 