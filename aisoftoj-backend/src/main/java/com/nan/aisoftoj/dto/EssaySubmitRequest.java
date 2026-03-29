package com.nan.aisoftoj.dto;

import lombok.Data;

@Data
public class EssaySubmitRequest {

    /**
     * 题目ID
     */
    private Long questionId;

    /**
     * 摘要
     */
    private String abstractText;

    /**
     * 论文正文
     */
    private String content;
}
