package com.nan.aisoftoj.service.impl;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nan.aisoftoj.consts.PracticeSessionState;
import com.nan.aisoftoj.dto.*;
import com.nan.aisoftoj.entity.Paper;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.entity.PracticeSessionQuestionRecord;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.PracticeSessionQuestionRecordMapper;
import com.nan.aisoftoj.service.PaperService;
import com.nan.aisoftoj.service.PracticeSessionService;
import com.nan.aisoftoj.service.QuestionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PracticeSessionServiceImpl implements PracticeSessionService {

    @Autowired
    private PaperService paperService;
    @Autowired
    private QuestionService questionService;
	@Autowired
	private PracticeSessionMapper practiceSessionMapper;
    @Autowired
    private PracticeSessionQuestionRecordMapper practiceSessionQuestionRecordMapper;


    @Override
    @Transactional(rollbackFor = Exception.class)
    public StartPracticeSessionRes startPracticeSession(StartPracticeSessionReq startPracticeSessionReq) {

        // 从请求中获取试卷ID
        Integer paperId =  startPracticeSessionReq.getPaperId();

        //校验paperId是否存在
        Paper paper = paperService.getById(paperId);
        if (paper == null) {
            throw new IllegalArgumentException("试卷不存在");
        }

        //检查用户是否已创建该试卷的会话记录
        PracticeSession practiceSession = practiceSessionMapper.selectOne(
                new LambdaQueryWrapper<PracticeSession>()
                        .eq(PracticeSession::getPaperId, paperId)
                        .eq(PracticeSession::getUserId, 1)
                        .eq(PracticeSession::getStatus, PracticeSessionState.DOING.getCode())
        );
        if (practiceSession != null) {
           // 如果存在未完成的记录，返回该记录ID
			return getStatPracticeSessionRes(practiceSession, paperId, paper);
        }

        //创建试卷会话记录
        PracticeSession insertPracticeSession = new PracticeSession();
        insertPracticeSession.setPaperId(paperId);
        insertPracticeSession.setUserId(1);
        insertPracticeSession.setStartTime(new Date());
        insertPracticeSession.setStatus(PracticeSessionState.DOING.getCode());
        insertPracticeSession.setTotalScore(BigDecimal.valueOf(75));
        // 插入记录到数据库
        practiceSessionMapper.insert(insertPracticeSession);


        //初始化会话题目记录PracticeSessionQuestionRecord
        initPracticeSessionQuestionRecord(paperId, insertPracticeSession.getId());

        // 返回新创建的会话记录
		return getStatPracticeSessionRes(insertPracticeSession, paperId, paper);
    }


    private StartPracticeSessionRes getStatPracticeSessionRes(PracticeSession practiceSession, Integer paperId, Paper paper) {
        StartPracticeSessionRes res = new StartPracticeSessionRes();
        res.setPracticeSessionId(practiceSession.getId());
        res.setPaperId(paperId);
        res.setPaperName(paper.getName());
        res.setPaper(paper);
        //找出所有与试卷关联的题目
        List<Question> questions = questionService.listByPaperId(paperId);
        // 转换为DTO格式
        List<QuestionDTO> questionDTOs = getQuestionDTOS(questions);
        res.setQuestionList(questionDTOs);
        return res;
    }



	private List<QuestionDTO> getQuestionDTOS(List<Question> questions) {
		return questions.stream()
				.map(question -> {
					QuestionDTO questionDTO = new QuestionDTO();
					questionDTO.setId(question.getId());
					questionDTO.setName(question.getName());
					questionDTO.setIntro(question.getIntro());
					questionDTO.setOptions(parseOptions(question.getOptions()));
					questionDTO.setAnswer(question.getAnswer());
					questionDTO.setAnalysis(question.getAnalysis());
					questionDTO.setQuestionType(question.getQuestionType());
					questionDTO.setDifficulty(question.getDifficulty());
					return questionDTO;
				})
				.collect(Collectors.toList());
    }

    private List<Option> parseOptions(String rawOptions) {
        if (rawOptions == null || rawOptions.trim().isEmpty()) {
            return new ArrayList<>();
        }
        if (!JSONUtil.isTypeJSONArray(rawOptions)) {
            return new ArrayList<>();
        }

        try {
            List<Option> optionList = JSONUtil.toList(rawOptions, Option.class);
            if (!optionList.isEmpty() && optionList.get(0).getValueStr() != null) {
                return optionList;
            }
        } catch (Exception ignored) {
        }

        List<String> values = JSONUtil.toList(rawOptions, String.class);
        List<Option> options = new ArrayList<>();
        for (int i = 0; i < values.size(); i++) {
            Option option = new Option();
            option.setKeyStr(String.valueOf((char) ('A' + i)));
            option.setValueStr(values.get(i));
            option.setOrderNum(i + 1);
            options.add(option);
        }
        return options;
    }


    private void initPracticeSessionQuestionRecord(Integer paperId, Integer practiceSessionId) {

        //1. 从数据库中查询所有与试卷相关的题目
        List<Question> questions = questionService.listByPaperId(paperId);
        if (questions.isEmpty()) {
            throw new IllegalArgumentException("试卷不存在题目");
        }

        //2. 遍历题目列表，创建PracticeSessionQuestionRecord记录
        for (Question question : questions) {
            PracticeSessionQuestionRecord practiceSessionQuestionRecord = new PracticeSessionQuestionRecord();
            practiceSessionQuestionRecord.setSessionId(practiceSessionId);
            practiceSessionQuestionRecord.setQuestionId(question.getId());
            practiceSessionQuestionRecordMapper.insert(practiceSessionQuestionRecord);
        }

    }

    @Override
    public GETPracticeSessionRes getPracticeSessionDetail(Integer practiceSessionId) {
        //校验practiceSessionId是否存在
        PracticeSession practiceSession = practiceSessionMapper.selectById(practiceSessionId);
        if (practiceSession == null) {
            throw new IllegalArgumentException("试卷会话记录不存在");
        }
        //获取试卷信息
        Paper paper = paperService.getById(practiceSession.getPaperId());
        if (paper == null) {
            throw new IllegalArgumentException("试卷不存在");
        }


        //返回试卷和题目信息
        GETPracticeSessionRes resDTO = new GETPracticeSessionRes();
        resDTO.setId(practiceSession.getId());
        resDTO.setUserId(practiceSession.getUserId());
        resDTO.setPaperId(practiceSession.getPaperId());
        resDTO.setPaperName(paper.getName());
        resDTO.setPaper(paper);

        //找出所有与试卷关联的题目
        List<Question> questions = questionService.listByPaperId(practiceSession.getPaperId());
        // 转换为DTO格式
        getQuestionDTOs(questions, resDTO);
        return resDTO;

    }

    private void getQuestionDTOs(List<Question> questions, GETPracticeSessionRes resDTO) {
        List<QuestionDTO> questionDTOs = getQuestionDTOS(questions);
        resDTO.setQuestionList(questionDTOs);
    }


    @Override
    public PaperSubmitResponse submitPracticeSession(Integer practiceSessionId, PaperSubmitRequest request) {
        // 这里应该实现具体的交卷逻辑
        // 1. 校验试卷记录是否存在
        // 2. 计算分数
        // 3. 更新试卷记录状态
        // 4. 返回结果

//        // 1. 校验试卷记录是否存在
//        PaperRecord paperRecord = paperRecordMapper.selectById(paperRecordId);
//        if (paperRecord == null) {
//            throw new IllegalArgumentException("试卷记录不存在");
//        }
//
//
//        // 3. 更新试卷记录状态
//        PaperRecord updatePaperRecord = new PaperRecord();
//        updatePaperRecord.setId(paperRecordId);
//        updatePaperRecord.setStatus(1);
//        updatePaperRecord.setEndTime(new Date());
//        updatePaperRecord.setScore(BigDecimal.valueOf(11));
//        paperRecordMapper.updateById(updatePaperRecord);
//
//
//        // 4. 返回结果
//        PaperSubmitResponse response = new PaperSubmitResponse();
//        response.setScore(updatePaperRecord.getScore());
//        response.setTotalScore(updatePaperRecord.getTotalScore());
//        response.setStatus(updatePaperRecord.getStatus());

//        return response;


        return null;
    }
}
