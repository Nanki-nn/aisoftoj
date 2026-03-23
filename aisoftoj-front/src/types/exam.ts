// 考试相关类型定义

export interface Question {
  id: string;
  type: 'single' | 'multiple' | 'fill' | 'judge';
  subject: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  year?: number;
}

export interface ExamSession {
  id: string;
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
  subject: string;
  category: string;
  questionCount: number;
  timeLimit?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  randomOrder: boolean;
  examMode: 'exam' | 'practice'; // 考试模式或练题模式
}