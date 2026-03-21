package com.nan.aisoftoj.dto;


import lombok.Data;

@Data
public class StartPracticeSessionReq {

	/**
	 * 试卷id，非空
	 */
	private Integer paperId;

	/**
	 * 刷题模式
	 */
	private Integer mode = 1;


}