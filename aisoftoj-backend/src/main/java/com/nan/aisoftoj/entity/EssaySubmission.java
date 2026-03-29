package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("essay_submission")
public class EssaySubmission {

    /**
     * 主键
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 题目ID
     */
    private Long questionId;

    /**
     * 摘要
     */
    @TableField(value = "abstract")
    private String abstractText;

    /**
     * 论文正文
     */
    private String content;

    /**
     * 字数
     */
    private Integer wordCount;

    /**
     * 状态: 0-待批改, 1-批改中, 2-已完成, 3-批改失败
     */
    private Integer status;

    /**
     * 总分
     */
    private BigDecimal totalScore;

    /**
     * 创建时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /**
     * 是否删除: 0-未删除, 1-已删除
     */
    @TableLogic
    private Integer isDeleted;
}
