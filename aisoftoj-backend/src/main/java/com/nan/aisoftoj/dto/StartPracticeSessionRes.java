package com.nan.aisoftoj.dto;

import com.nan.aisoftoj.entity.Paper;
import com.nan.aisoftoj.entity.Question;
import lombok.Data;

import java.util.List;

@Data
public class StartPracticeSessionRes {

	/**
	 * 试卷会话记录id
	 */
	private Integer practiceSessionId;

	/**
	 * 试卷id
	 */
	private Integer paperId;


	/**
	 * 试卷名称
	 */
	private String paperName;


	/**
	 * 试卷信息
	 */
	private Paper paper;

	/**
	 * 题目列表
	 */
	private List<QuestionDTO> questionList;

}
