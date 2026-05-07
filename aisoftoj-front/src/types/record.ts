// 刷题和错题记录类型定义

// 刷题会话记录
export interface PracticeSessionRecord {
  id: string;
  examName: string; // 题库名称
  examMode: 'exam' | 'practice'; // 练习模式
  examType: string; // 题库类型（综合知识/案例真题等）
  createTime: string; // 创建时间
  answeredCount: number; // 已答题数
  totalCount: number; // 总题数
  status: 'inProgress' | 'completed'; // 状态
}

export interface PageResult<T> {
  records: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 错题记录
export interface PracticeRecord {
  id: string;
  sessionId?: string | number | null;
  questionId?: string | number | null;
  topicName: string;
  questionBank: string;
  topicType: string;
  errorCount: number;
  updateTime: string;
  importance: 'low' | 'medium' | 'high' | 'must';
}

export const importanceLevels = {
  low: { label: '了解即可', color: 'bg-green-100 text-green-700' },
  medium: { label: '建议掌握', color: 'bg-yellow-100 text-yellow-700' },
  high: { label: '必须掌握', color: 'bg-orange-100 text-orange-700' },
  must: { label: '看一眼即可', color: 'bg-blue-100 text-blue-700' }
};
