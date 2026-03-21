package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
public class PracticeSession {
    /**
     * 主键
     */
    @TableId(type = IdType.AUTO)
    private Integer id;
    
    /**
     * 用户ID
     */
    private Integer userId;
    
    /**
     * 试卷ID
     */
    private Integer paperId;
    
    /**
     * 开始答题时间
     */
    private Date startTime;
    
    /**
     * 结束时间（未完成时为默认值）
     */
    private Date endTime;
    
    /**
     * 用户得分
     */
    private BigDecimal score;
    
    /**
     * 试卷总分
     */
    private BigDecimal totalScore;
    
    /**
     * 状态: 0-未完成, 1-已完成
     */
    private Integer status;
    
    /**
     * 创建时间
     */
    private Date createTime;

    /**
     * 是否删除: 0-未删除, 1-已删除
     */
    private Integer isDeleted;
    
    /**
     * 更新时间
     */
    private Date updateTime;
}