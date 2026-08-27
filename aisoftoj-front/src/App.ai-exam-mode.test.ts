import { describe, expect, it } from 'vitest';
import { isAiAssistantDisabledForSession } from './App';
import { ExamSession } from './types/exam';

const session = (examMode: ExamSession['examMode'], isCompleted = false): ExamSession => ({
  id: '12',
  paperId: '3',
  paperName: '测试试卷',
  subject: '系统架构设计师',
  category: '综合知识',
  examMode,
  questions: [],
  answers: {},
  startTime: new Date(),
  isCompleted,
});

describe('AI assistant exam-mode guard', () => {
  it('disables AI throughout an active exam session', () => {
    expect(isAiAssistantDisabledForSession('/exam/session/12', session('exam'))).toBe(true);
  });

  it('keeps AI available for practice and completed exams', () => {
    expect(isAiAssistantDisabledForSession('/exam/session/12', session('practice'))).toBe(false);
    expect(isAiAssistantDisabledForSession('/exam/session/12', session('exam', true))).toBe(false);
  });
});
