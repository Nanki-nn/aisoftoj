package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("textbook_section")
public class TextbookSection {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long textbookId;
    private Long parentId;
    private Integer level;
    private String sectionCode;
    private String title;
    private Integer printedPageStart;
    private Integer printedPageEnd;
    private Integer pdfPageStart;
    private Integer pdfPageEnd;
    private Integer sortOrder;
    private Integer isDeleted;
    private Date createTime;
    private Date updateTime;
}
