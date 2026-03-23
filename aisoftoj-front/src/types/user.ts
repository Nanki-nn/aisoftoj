// 用户相关类型定义

export interface User {
  id: string;
  username: string;
  email: string;
  nickname: string;
  avatar?: string;
  phone?: string;
  joinDate: string;
  lastLoginDate: string;
  totalExams: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  studyDays: number;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  points: number;
  badges: string[];
}

export interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  nickname: string;
  phone?: string;
  agreeToTerms: boolean;
}

export interface UserStats {
  totalExams: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  studyDays: number;
  level: string;
  points: number;
  recentActivity: {
    date: string;
    type: 'exam' | 'practice';
    subject: string;
    score?: number;
  }[];
  weakSubjects: {
    subject: string;
    accuracy: number;
  }[];
  achievements: {
    title: string;
    description: string;
    unlockedDate: string;
    icon: string;
  }[];
}