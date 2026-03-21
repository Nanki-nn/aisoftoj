package com.nan.aisoftoj.consts;


/**
 * 状态: 0-未完成, 1-已完成
 */
public enum PracticeSessionState {
	/**
	 * 进行中
	 */
	DOING(0, "进行中"),
	/**
	 * 已完成
	 */
	FINISHED(1, "已完成");

	/**
	 * 状态码
	 */
	private int code;

	/**
	 * 状态描述
	 */
	private String desc;

	PracticeSessionState(int code, String desc) {
		this.code = code;
		this.desc = desc;
	}
	/**
	 * 获取状态码
	 * @return 状态码
	 */
	public int getCode() {
		return code;
	}

	/**
	 * 获取状态描述
	 * @return 状态描述
	 */
	public String getDesc() {
		return desc;
	}

}
