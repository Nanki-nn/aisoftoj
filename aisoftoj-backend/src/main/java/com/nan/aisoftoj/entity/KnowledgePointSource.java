package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("knowledge_point_source")
public class KnowledgePointSource {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long knowledgePointId;
    private Long textbookSectionId;
    private Integer printedPageStart;
    private Integer printedPageEnd;
    private Integer pdfPageStart;
    private Integer pdfPageEnd;
    private Boolean isPrimary;
    private Integer isDeleted;
    private Date createTime;
    private Date updateTime;
}
