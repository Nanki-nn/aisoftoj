package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Getter;
import lombok.Setter;

import java.util.Date;

@Setter
@Getter
public class Paper {
    // Getters and Setters
    @TableId(type = IdType.AUTO)
    private Integer id;
    private String frontMockId;
    private Integer paperCateId;
    private Integer subjectId;
    private String subjectName;
    private Integer paperYear;
    private Integer paperMonth;
    private String name;
    private Integer orderNum;
    private Integer questionTotal;
    private Integer readCt;
    private Boolean publishStatus;
    private String mockStatus;
    private Integer completedCount;
    private Boolean isDeleted;
    
    @JsonFormat(pattern = "yyyy年MM月dd日 HH时mm分ss秒", timezone = "GMT+8")
    private Date createTime;
    
    @JsonFormat(pattern = "yyyy年MM月dd日 HH时mm分ss秒", timezone = "GMT+8")
    private Date updateTime;


}
