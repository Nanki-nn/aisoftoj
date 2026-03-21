package com.nan.aisoftoj.consts;

/**
 * 科目枚举
 * 1-系统分析师 2-系统架构师
 */
public enum PaperSubject {
    /**
     * 系统分析师
     */
    SYSTEM_ANALYST(1, "系统分析师"),
    
    /**
     * 系统架构师
     */
    SYSTEM_ARCHITECT(2, "系统架构师");

    private final Integer code;
    private final String description;

    PaperSubject(Integer code, String description) {
        this.code = code;
        this.description = description;
    }

    public Integer getCode() {
        return code;
    }

    public String getDescription() {
        return description;
    }

    /**
     * 根据code获取枚举值
     *
     * @param code 科目代码
     * @return 对应的枚举值，找不到返回null
     */
    public static PaperSubject fromCode(Integer code) {
        for (PaperSubject subject : PaperSubject.values()) {
            if (subject.getCode().equals(code)) {
                return subject;
            }
        }
        return null;
    }

    /**
     * 判断code是否有效
     *
     * @param code 科目代码
     * @return 是否有效
     */
    public static boolean isValidCode(Integer code) {
        return fromCode(code) != null;
    }
}