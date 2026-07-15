package com.nan.aisoftoj.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;
import lombok.Setter;

import java.util.Date;

/**
 * 面向普通用户的试卷目录 DTO。
 * 公共字段可供游客浏览；个人状态字段仅在已认证请求中赋值并输出。
 */
@Getter
@Setter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PaperDTO {
    private Integer id;
    private String name;
    private String subjectName;
    private Integer paperCateId;
    private Integer paperYear;
    private Integer paperMonth;
    private Integer questionTotal;

    @JsonFormat(pattern = "yyyy年MM月dd日 HH时mm分ss秒", timezone = "GMT+8")
    private Date updateTime;

    /** 当前用户在该试卷下创建过的会话数。 */
    private Integer readCt;

    /** 当前用户在该试卷中的已完成题数。 */
    private Integer completedCount;

    /** 当前用户正在进行的会话 ID。 */
    private Integer doingSessionId;

    /** 当前用户的试卷状态。 */
    private String paperStatus;
}
