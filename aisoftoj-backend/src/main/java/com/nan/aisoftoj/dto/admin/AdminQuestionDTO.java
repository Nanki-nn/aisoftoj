package com.nan.aisoftoj.dto.admin;

import lombok.Data;

import java.util.Date;

@Data
public class AdminQuestionDTO {
    private Integer id;
    private String name;
    private String intro;
    private String options;
    private String answer;
    private String analysis;
    private Integer questionType;
    private Integer difficulty;
    private Integer readCt;
    private Date createTime;
    private Date updateTime;
    /** 关联试卷的科目名称（取最新一份试卷） */
    private String subjectName;
    /** 关联试卷的年份（取最新一份试卷） */
    private Integer paperYear;
    /** 关联试卷的月份（取最新一份试卷） */
    private Integer paperMonth;
    /** 关联试卷的分类（1综合知识/2案例分析/3论文） */
    private Integer paperCateId;
}
