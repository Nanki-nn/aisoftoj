import { useState, useCallback } from 'react';
import { ExamSession, ExamConfig, Question } from '../types/exam';
import { filterQuestions, getQuestionsByPaper } from '../data/questions';
import { ExamPaper } from '../data/examPapers';

export function useExamSession() {
  const [currentSession, setCurrentSession] = useState<ExamSession | null>(null);

  const startExam = useCallback((config: ExamConfig) => {
    const questions = filterQuestions(
      config.subject,
      config.category,
      config.difficulty,
      config.questionCount
    );

    if (questions.length === 0) {
      throw new Error('没有找到符合条件的题目');
    }

    // 如果需要随机排序
    const sortedQuestions = config.randomOrder 
      ? questions.sort(() => Math.random() - 0.5)
      : questions;

    const session: ExamSession = {
      id: `exam_${Date.now()}`,
      subject: config.subject,
      category: config.category,
      questions: sortedQuestions.slice(0, config.questionCount),
      answers: {},
      startTime: new Date(),
      timeLimit: config.timeLimit,
      isCompleted: false,
      examMode: config.examMode,
    };

    setCurrentSession(session);
    return session;
  }, []);

  const startPaperExam = useCallback((paper: ExamPaper) => {
    const questions = getQuestionsByPaper(paper);

    const session: ExamSession = {
      id: `paper_${paper.id}_${Date.now()}`,
      subject: paper.subject,
      category: paper.category,
      questions,
      answers: {},
      startTime: new Date(),
      timeLimit: undefined, // 历年真题不限时
      isCompleted: false,
      examMode: 'practice', // 默认历年真题为练题模式
    };

    setCurrentSession(session);
    return session;
  }, []);

  const updateAnswer = useCallback((questionId: string, answer: string | string[]) => {
    if (!currentSession) return;

    setCurrentSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        answers: {
          ...prev.answers,
          [questionId]: answer,
        },
      };
    });
  }, [currentSession]);

  const completeExam = useCallback(() => {
    if (!currentSession) return null;

    const completedSession: ExamSession = {
      ...currentSession,
      endTime: new Date(),
      isCompleted: true,
    };

    setCurrentSession(completedSession);
    return completedSession;
  }, [currentSession]);

  const resetSession = useCallback(() => {
    setCurrentSession(null);
  }, []);

  const setSession = useCallback((session: ExamSession | null) => {
    setCurrentSession(session);
  }, []);

  return {
    currentSession,
    startExam,
    startPaperExam,
    updateAnswer,
    completeExam,
    resetSession,
    setSession,
  };
}
