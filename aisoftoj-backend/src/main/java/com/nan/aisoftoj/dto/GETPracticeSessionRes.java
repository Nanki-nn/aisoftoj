package com.nan.aisoftoj.dto;

import com.nan.aisoftoj.entity.Paper;
import com.nan.aisoftoj.entity.Question;
import lombok.Data;
import java.util.Date;
import java.util.List;

@Data
public class GETPracticeSessionRes {


    private long id;

    private int userId;

    private int paperId;

    private String examMode;

    /**
     * 会话状态: 0-进行中, 1-已完成
     */
    private Integer status;

    /**
     * 开始答题时间
     */
    private Date startTime;

    /**
     * 结束答题时间
     */
    private Date endTime;

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
