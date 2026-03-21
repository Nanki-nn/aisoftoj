package com.nan.aisoftoj.consts;

/**
 * 试卷分类枚举
 * 1-综合题 2-案例题 3-论文题
 */
public enum PaperCate {
    /**
     * 综合题
     */
    COMPREHENSIVE(1, "综合知识"),
    
    /**
     * 案例题
     */
    CASE_STUDY(2, "案例分析"),
    
    /**
     * 论文题
     */
    ESSAY(3, "论文");

    private final Integer code;
    private final String description;

    PaperCate(Integer code, String description) {
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
     * @param code 试卷分类代码
     * @return 对应的枚举值，找不到返回null
     */
    public static PaperCate fromCode(Integer code) {
        for (PaperCate paperCate : PaperCate.values()) {
            if (paperCate.getCode().equals(code)) {
                return paperCate;
            }
        }
        return null;
    }

    /**
     * 判断code是否有效
     *
     * @param code 试卷分类代码
     * @return 是否有效
     */
    public static boolean isValidCode(Integer code) {
        return fromCode(code) != null;
    }
}