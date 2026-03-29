package com.nan.aisoftoj.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class EssayResultResponse {

    /**
     * 提交记录ID
     */
    private Long submissionId;

    /**
     * 状态: 0-待批改, 1-批改中, 2-已完成, 3-批改失败
     */
    private Integer status;

    /**
     * 总分
     */
    private BigDecimal totalScore;

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
     * 改进建议列表
     */
    private List<String> suggestions;
}
