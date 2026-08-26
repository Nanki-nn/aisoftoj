package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("knowledge_point")
public class KnowledgePoint {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String subjectName;
    private Long parentId;
    private Integer level;
    private String code;
    private String name;
    private String description;
    private String status;
    private Integer isDeleted;
    private Date createTime;
    private Date updateTime;
}
