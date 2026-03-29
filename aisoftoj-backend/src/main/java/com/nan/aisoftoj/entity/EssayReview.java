package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("essay_review")
public class EssayReview {

    /**
     * 主键
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 提交记录ID
     */
    private Long submissionId;

    /**
     * 摘要得分
     */
    private BigDecimal scoreAbstract;

    /**
     * 结构得分
     */
    private BigDecimal scoreStructure;

    /**
     * 相关性得分
     */
    private BigDecimal scoreRelevance;

    /**
     * 深度得分
     */
    private BigDecimal scoreDepth;

    /**
     * 论据得分
     */
    private BigDecimal scoreEvidence;

    /**
     * 语言得分
     */
    private BigDecimal scoreLanguage;

    /**
     * 总分
     */
    private BigDecimal totalScore;

    /**
     * 改进建议（JSON格式存储）
     */
    private String suggestions;

    /**
     * 原始AI返回内容
     */
    private String rawResponse;

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
