package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;

import java.util.Date;

@Data
public class PracticeSessionQuestionRecord {
    /**
     * 主键
     */
    @TableId(type = IdType.AUTO)
    private Integer id;

    /**
     * 练习会话ID
     */
    private Integer sessionId;

    /**
     * 题目ID
     */
    private Integer questionId;

    /**
     * 用户答案
     */
    private String userAnswer;

    /**
     * 答案乐观版本号。
     */
    private Long answerRevision;

    /**
     * 最近一次成功写入的客户端变更标识。
     */
    private String lastMutationId;

    /**
     * 练题模式确认时间；确认后不可再修改草稿。
     */
    private Date confirmedAt;

    /**
     * 是否已提交
     */
    private Boolean isSubmitted;

    /**
     * 是否正确
     */
    private Boolean isCorrect;

    /**
     * 本题耗时（秒）
     */
    private Integer spendTime;

    /**
     * 创建时间
     */
    private Date createTime;

    /**
     * 更新时间
     */
    private Date updateTime;

    /**
     * 删除状态：0-未删除，1-已删除
     */
    private Boolean isDeleted;
}
