package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;

import java.util.Date;

@Data
public class UserWrongQuestionStat {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String sourceFrontId;
    private String sourceType;
    private Integer userId;
    private Integer paperId;
    private Integer questionId;
    private String questionName;
    private String paperName;
    private String topicType;
    private Integer errorCount;
    private String importanceLevel;
    private Date lastWrongTime;
    private Date createTime;
    private Date updateTime;
    private Integer isDeleted;
}
