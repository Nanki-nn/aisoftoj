package com.nan.aisoftoj.dto;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.nan.aisoftoj.entity.Paper;
import lombok.Getter;
import lombok.Setter;

import java.util.Date;

/**
 * 试卷DTO，包含试卷基本信息以及答题状态信息
 */
@Setter
@Getter
public class PaperDTO {

    @TableId(type = IdType.AUTO)
    private Integer id;


    private Integer paperSubjectId;

    private Integer paperCateId;

    private String name;

    private Integer orderNum;

    private Integer questionTotal;

    private Integer readCt;

    /**
     * 正在进行的答题记录ID
     */
    private Integer doingSessionId;

    /**
     * 试卷状态
     */
    private String paperStatus;

    /**
     * 做题进度（已完成题目数）
     */
    private Integer progress;


    private Boolean isDeleted;

    @JsonFormat(pattern = "yyyy年MM月dd日 HH时mm分ss秒", timezone = "GMT+8")
    private Date createTime;

    @JsonFormat(pattern = "yyyy年MM月dd日 HH时mm分ss秒", timezone = "GMT+8")
    private Date updateTime;


}