// 考试相关类型定义

export interface ExamPaper {
  id: string;
  year: number;
  month: number;
  subject: string;
  category: '综合知识' | '案例分析' | '论文';
  questionCount: number;
  lastUpdated: string;
  practiceCount: number;
  status: 'not_started' | 'in_progress' | 'completed';
  completedCount?: number;
  doingSessionId?: string | null;
}

export interface QuestionOption {
  key: string;
  text: string;
  correct?: boolean;
}

export interface Question {
  id: string;
  type: 'single' | 'multiple' | 'fill' | 'judge' | 'essay';
  subject: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  isMarkdown?: boolean;
  options?: Array<string | QuestionOption>;
  correctAnswer: string | string[];
  explanation: string;
  year?: number;
  questionRecordId?: string;
  userAnswer?: string | string[];
  isSubmitted?: boolean;
  isCorrect?: boolean | null;
  spendTime?: number;
}

export interface ExamSession {
  id: string;
  paperId?: string;
  paperName?: string;
  subject: string;
  category: string;
  questions: Question[];
  answers: Record<string, string | string[]>;
  startTime: Date;
  endTime?: Date;
  timeLimit?: number; // 分钟
  score?: number;
  isCompleted: boolean;
  examMode: 'exam' | 'practice'; // 考试模式或练题模式
}

export interface UserStats {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  subjectStats: Record<string, {
    total: number;
    correct: number;
    accuracy: number;
  }>;
  recentSessions: ExamSession[];
}

export interface ExamConfig {
  paperId?: string;
  paperName?: string;
  subject: string;
  category: string;
  questionCount: number;
  timeLimit?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  randomOrder: boolean;
  examMode: 'exam' | 'practice'; // 考试模式或练题模式
}
