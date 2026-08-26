package com.nan.aisoftoj.service.impl;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.nan.aisoftoj.entity.Paper;
import com.nan.aisoftoj.entity.PracticeSession;
import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.entity.Textbook;
import com.nan.aisoftoj.entity.TextbookSection;
import com.nan.aisoftoj.entity.KnowledgePoint;
import com.nan.aisoftoj.entity.KnowledgePointSource;
import com.nan.aisoftoj.mapper.PaperMapper;
import com.nan.aisoftoj.mapper.PracticeSessionMapper;
import com.nan.aisoftoj.mapper.QuestionMapper;
import com.nan.aisoftoj.mapper.UserMapper;
import com.nan.aisoftoj.mapper.UserWrongQuestionStatMapper;
import com.nan.aisoftoj.mapper.TextbookMapper;
import com.nan.aisoftoj.mapper.TextbookSectionMapper;
import com.nan.aisoftoj.mapper.KnowledgePointMapper;
import com.nan.aisoftoj.mapper.KnowledgePointSourceMapper;
import com.nan.aisoftoj.dto.ai.AiPaperDTO;
import com.nan.aisoftoj.dto.ai.AiQuestionDTO;
import com.nan.aisoftoj.dto.ai.AiTextbookCatalogDTO;
import com.nan.aisoftoj.dto.ai.AiTextbookTraceQuestionDTO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.apache.ibatis.builder.MapperBuilderAssistant;

import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiPlatformCatalogReadServiceTest {

    @Mock
    private UserMapper userMapper;
    @Mock
    private PracticeSessionMapper practiceSessionMapper;
    @Mock
    private UserWrongQuestionStatMapper wrongQuestionStatMapper;
    @Mock
    private PaperMapper paperMapper;
    @Mock
    private QuestionMapper questionMapper;
    @Mock
    private TextbookMapper textbookMapper;
    @Mock
    private TextbookSectionMapper textbookSectionMapper;
    @Mock
    private KnowledgePointMapper knowledgePointMapper;
    @Mock
    private KnowledgePointSourceMapper knowledgePointSourceMapper;
    @InjectMocks
    private AiPlatformReadServiceImpl service;

    @Test
    void paperAggregationSelectsMostActiveOngoingSessionDeterministically() {
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), ""),
                PracticeSession.class);
        Paper paper = new Paper();
        paper.setId(3);
        paper.setName("2026 综合知识");
        paper.setPaperCateId(1);
        paper.setQuestionTotal(50);
        paper.setIsDeleted(false);
        paper.setPublishStatus(true);
        when(paperMapper.selectList(any())).thenReturn(Collections.singletonList(paper));

        PracticeSession older = session(11, 3, 0, 10, 80);
        PracticeSession newer = session(12, 3, 0, 20, 999);
        when(practiceSessionMapper.selectList(any())).thenReturn(Arrays.asList(older, newer));

        List<AiPaperDTO> result = service.listPapers(7);

        assertEquals(1, result.size());
        assertEquals("in_progress", result.get(0).getPracticeStatus());
        assertEquals(12, result.get(0).getOngoingSessionId());
        assertEquals(50, result.get(0).getCompletedQuestionCount());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Wrapper<PracticeSession>> queryCaptor =
                ArgumentCaptor.forClass(Wrapper.class);
        verify(practiceSessionMapper).selectList(queryCaptor.capture());
        String selectedColumns = queryCaptor.getValue().getSqlSelect();
        assertTrue(selectedColumns.contains("paper_id"));
        assertFalse(selectedColumns.contains("merged_into_session_id"));
    }

    @Test
    void questionOutputContainsNoAnswerBearingFields() {
        Question question = new Question();
        question.setId(8);
        question.setName("题目");
        question.setIntro("题干");
        question.setOptions("[{\"keyStr\":\"A\",\"valueStr\":\"选项A\",\"orderNum\":1}]");
        question.setAnswer("A");
        question.setAnalysis("解析");
        question.setQuestionType(1);
        question.setDifficulty(3);
        question.setIsDeleted(0);
        when(questionMapper.selectById(8)).thenReturn(question);
        when(questionMapper.countPublishedPaperRelations(8)).thenReturn(1);

        AiQuestionDTO result = service.getQuestion(8);

        assertEquals(8, result.getQuestionId());
        assertEquals("题干", result.getContent());
        assertEquals("single_choice", result.getQuestionType());
        assertEquals("hard", result.getDifficulty());
        assertEquals("A", result.getOptions().get(0).getKey());
        assertEquals("选项A", result.getOptions().get(0).getContent());
    }

    @Test
    void invalidQuestionIdIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.getQuestion(0));
    }

    @Test
    void traceQuestionAddsSubjectAndAnalysisAfterPublishedAccessCheck() {
        Question question = new Question();
        question.setId(9);
        question.setName("题目");
        question.setIntro("题干");
        question.setOptions("[]");
        question.setAnalysis("可信解析");
        question.setQuestionType(1);
        question.setDifficulty(2);
        question.setIsDeleted(0);
        when(questionMapper.selectById(9)).thenReturn(question);
        when(questionMapper.countPublishedPaperRelations(9)).thenReturn(1);
        when(questionMapper.selectPublishedSubjectName(9)).thenReturn("系统架构设计师");

        AiTextbookTraceQuestionDTO result = service.getTextbookTraceQuestion(9);

        assertEquals("系统架构设计师", result.getSubjectName());
        assertEquals("可信解析", result.getAnalysis());
    }

    @Test
    void activeCatalogReturnsStableSectionsAndKnowledgePointSources() {
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), ""), Textbook.class);
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), ""), TextbookSection.class);
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), ""), KnowledgePoint.class);
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), ""), KnowledgePointSource.class);
        Textbook textbook = new Textbook();
        textbook.setId(1L);
        textbook.setSubjectName("系统架构设计师");
        textbook.setName("系统架构设计师教程");
        textbook.setEdition("第1版");
        textbook.setOfficialUrl("https://books.example/authorized.pdf");
        textbook.setIsDeleted(0);
        TextbookSection section = new TextbookSection();
        section.setId(11L);
        section.setTextbookId(1L);
        section.setLevel(2);
        section.setSectionCode("3.2");
        section.setTitle("架构风格");
        section.setPrintedPageStart(86);
        section.setPrintedPageEnd(89);
        section.setPdfPageStart(92);
        section.setPdfPageEnd(95);
        section.setSortOrder(1);
        KnowledgePoint point = new KnowledgePoint();
        point.setId(101L);
        point.setSubjectName("系统架构设计师");
        point.setLevel(1);
        point.setCode("ARCH-STYLE");
        point.setName("架构风格");
        KnowledgePointSource source = new KnowledgePointSource();
        source.setId(1001L);
        source.setKnowledgePointId(101L);
        source.setTextbookSectionId(11L);
        source.setPrintedPageStart(86);
        source.setPrintedPageEnd(89);
        source.setPdfPageStart(92);
        source.setPdfPageEnd(95);
        source.setIsPrimary(true);
        when(textbookMapper.selectOne(any())).thenReturn(textbook);
        when(textbookSectionMapper.selectList(any())).thenReturn(Collections.singletonList(section));
        when(knowledgePointMapper.selectList(any())).thenReturn(Collections.singletonList(point));
        when(knowledgePointSourceMapper.selectList(any())).thenReturn(Collections.singletonList(source));

        AiTextbookCatalogDTO result = service.getActiveTextbookCatalog("系统架构设计师");

        assertEquals(1L, result.getTextbookId());
        assertEquals(11L, result.getSections().get(0).getId());
        assertEquals(101L, result.getKnowledgePoints().get(0).getId());
        assertTrue(result.getKnowledgePoints().get(0).getSources().get(0).getPrimary());
    }

    private PracticeSession session(int id, int paperId, int status, int day, int answered) {
        PracticeSession session = new PracticeSession();
        session.setId(id);
        session.setPaperId(paperId);
        session.setStatus(status);
        session.setAnsweredCount(answered);
        session.setUpdateTime(new Date(1_700_000_000_000L + day * 86_400_000L));
        return session;
    }
}
