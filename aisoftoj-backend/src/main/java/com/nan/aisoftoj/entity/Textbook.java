package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("textbook")
public class Textbook {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String subjectName;
    private String name;
    private String edition;
    private String isbn;
    private String officialUrl;
    private String viewerPageTemplate;
    private String status;
    private Integer isDeleted;
    private Date createTime;
    private Date updateTime;
}
