package com.nan.aisoftoj.dto;

import com.nan.aisoftoj.entity.Paper;
import com.nan.aisoftoj.entity.Question;
import lombok.Data;
import java.util.List;

@Data
public class GETPracticeSessionRes {


    private long id;

    private int userId;

    private int paperId;

    private String examMode;

    /**
     * 试卷名称
     */
     private String paperName;

     /**
     * 试卷信息
      */
     private Paper paper;



    private List<QuestionDTO> questionList;

}
//
