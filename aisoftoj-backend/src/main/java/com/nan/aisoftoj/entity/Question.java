package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;
import java.util.Date;

@Data
public class Question {
    /**
     * 主键
     */
    @TableId(type = IdType.AUTO)
    private Integer id;

    /**
     * 题目名称（简要描述）
     */
    private String name;

    /**
     * 题目内容（含题干、选项等，支持HTML）
     */
    private String intro;

    /**
     * 选项
     */
    private String options;

    /**
     * 标准答案（单选/判断为"A"，多选为"A,B"，填空为"答案1||答案2"）
     */
    private String answer;

    /**
     * 题目解析
     */
    private String analysis;

    /**
     * 题型: 1-单选, 2-案例, 4-论文
     */
    private Integer questionType;

    /**
     * 难度: 1-易, 2-中, 3-难
     */
    private Integer difficulty;

    /**
     * 创建时间
     */
    private Date createTime;

    /**
     * 更新时间
     */
    private Date updateTime;

    /**
     * 删除状态，0-未删除，1-已删除
     */
    private Integer isDeleted;

    /**
     * 被作答次数
     */
    private Integer readCt;
}