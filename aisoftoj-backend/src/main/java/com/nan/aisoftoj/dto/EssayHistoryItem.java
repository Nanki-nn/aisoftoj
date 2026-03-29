package com.nan.aisoftoj.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class EssayHistoryItem {

    /**
     * 提交记录ID
     */
    private Long submissionId;

    /**
     * 题目ID
     */
    private Long questionId;

    /**
     * 题目标题
     */
    private String questionTitle;

    /**
     * 字数
     */
    private Integer wordCount;

    /**
     * 总分
     */
    private BigDecimal totalScore;

    /**
     * 状态: 0-待批改, 1-批改中, 2-已完成, 3-批改失败
     */
    private Integer status;

    /**
     * 提交时间
     */
    private LocalDateTime createTime;
}
