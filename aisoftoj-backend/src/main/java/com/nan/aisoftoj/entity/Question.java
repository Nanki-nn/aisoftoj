package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("question")
public class Question {
    @TableId
    private Long id;
    private String content;
    private Integer type; // 1单选 2多选 3判断 4简答
    private String options; // JSON字符串
    private String answer;
    private String analysis;
    private Long categoryId;
    private Integer difficulty;
} 