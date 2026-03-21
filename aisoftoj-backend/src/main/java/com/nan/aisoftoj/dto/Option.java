package com.nan.aisoftoj.dto;

import cn.hutool.json.JSONUtil;
import lombok.Data;
import java.util.ArrayList;
import java.util.List;

/**
 * 选项
 */
@Data
public class Option {

    private String keyStr;

    private String valueStr;

    private Integer orderNum;

    /**
     * 返回包含A、B、C、D四个选项的列表
     * @return 选项列表
     */
    public static List<Option> getDefaultOptions() {
        List<Option> options = new ArrayList<>();
        
        Option optionA = new Option();
        optionA.setKeyStr("A");
        optionA.setValueStr("");
        optionA.setOrderNum(1);
        options.add(optionA);
        
        Option optionB = new Option();
        optionB.setKeyStr("B");
        optionB.setValueStr("");
        optionB.setOrderNum(2);
        options.add(optionB);
        
        Option optionC = new Option();
        optionC.setKeyStr("C");
        optionC.setValueStr("");
        optionC.setOrderNum(3);
        options.add(optionC);
        
        Option optionD = new Option();
        optionD.setKeyStr("D");
        optionD.setValueStr("");
        optionD.setOrderNum(4);
        options.add(optionD);
        
        return options;
    }



        public static void main(String[] args) {
            List<Option> defaultOptions = Option.getDefaultOptions();
            System.out.println(JSONUtil.toJsonStr(defaultOptions));
        }
}