// 软考历年真题数据
export interface ExamPaper {
  id: string;
  year: number;
  month: number;
  subject: string;
  category: '综合知识' | '案例分析' | '论文';
  questionCount: number;
  lastUpdated: string;
  viewCount: number;
  status: 'not_started' | 'in_progress' | 'completed';
  completedCount?: number;
}

export const examPapers: ExamPaper[] = [
  {
    id: 'sa-2025-05-basic',
    year: 2025,
    month: 5,
    subject: '系统架构设计师',
    category: '综合知识',
    questionCount: 75,
    lastUpdated: '2025/10/3 22:35:00',
    viewCount: 1414,
    status: 'in_progress',
    completedCount: 45
  },
  {
    id: 'sa-2024-11-basic',
    year: 2024,
    month: 11,
    subject: '系统架构设计师',
    category: '综合知识',
    questionCount: 76,
    lastUpdated: '2025/10/3 16:59:32',
    viewCount: 1071,
    status: 'in_progress',
    completedCount: 32
  },
  {
    id: 'sa-2024-05-basic',
    year: 2024,
    month: 5,
    subject: '系统架构设计师',
    category: '综合知识',
    questionCount: 62,
    lastUpdated: '2025/10/2 19:21:16',
    viewCount: 611,
    status: 'in_progress',
    completedCount: 15
  },
  {
    id: 'sa-2023-basic',
    year: 2023,
    month: 11,
    subject: '系统架构设计师',
    category: '综合知识',
    questionCount: 65,
    lastUpdated: '2025/10/3 21:20:56',
    viewCount: 474,
    status: 'in_progress',
    completedCount: 28
  },
  {
    id: 'sa-2022-basic',
    year: 2022,
    month: 11,
    subject: '系统架构设计师',
    category: '综合知识',
    questionCount: 75,
    lastUpdated: '2025/10/3 06:15:41',
    viewCount: 313,
    status: 'in_progress',
    completedCount: 12
  },
  {
    id: 'sa-2021-basic',
    year: 2021,
    month: 11,
    subject: '系统架构设计师',
    category: '综合知识',
    questionCount: 73,
    lastUpdated: '2025/10/3 17:45:10',
    viewCount: 264,
    status: 'in_progress',
    completedCount: 20
  },
  {
    id: 'sa-2020-basic',
    year: 2020,
    month: 11,
    subject: '系统架构设计师',
    category: '综合知识',
    questionCount: 67,
    lastUpdated: '2025/10/3 16:28:47',
    viewCount: 207,
    status: 'not_started'
  },
  {
    id: 'sa-2019-basic',
    year: 2019,
    month: 11,
    subject: '系统架构设计师',
    category: '综合知识',
    questionCount: 72,
    lastUpdated: '2025/10/2 22:23:10',
    viewCount: 177,
    status: 'in_progress',
    completedCount: 8
  },
  {
    id: 'sa-2018-basic',
    year: 2018,
    month: 11,
    subject: '系统架构设计师',
    category: '综合知识',
    questionCount: 75,
    lastUpdated: '2025/10/3 09:58:01',
    viewCount: 119,
    status: 'not_started'
  },
  {
    id: 'sa-2017-basic',
    year: 2017,
    month: 11,
    subject: '系统架构设计师',
    category: '综合知识',
    questionCount: 73,
    lastUpdated: '2025/10/2 18:01:22',
    viewCount: 92,
    status: 'not_started'
  },
  {
    id: 'sa-2016-basic',
    year: 2016,
    month: 11,
    subject: '系统架构设计师',
    category: '综合知识',
    questionCount: 75,
    lastUpdated: '2025/9/30 22:03:22',
    viewCount: 76,
    status: 'not_started'
  },
  {
    id: 'sa-2015-basic',
    year: 2015,
    month: 11,
    subject: '系统架构设计师',
    category: '综合知识',
    questionCount: 75,
    lastUpdated: '2025/10/1 21:44:29',
    viewCount: 76,
    status: 'not_started'
  }
];

// 支持的科目列表
export const supportedSubjects = [
  '系统架构设计师',
  '系统分析师',
  '软件设计师',
  '网络工程师',
  '数据库系统工程师',
  '信息系统项目管理师'
];

// 支持的分类
export const supportedCategories = [
  '综合知识',
  '案例分析', 
  '论文'
];

// 根据筛选条件获取试卷
export const getFilteredPapers = (
  subject?: string,
  category?: string
): ExamPaper[] => {
  let filtered = examPapers;
  
  if (subject) {
    filtered = filtered.filter(paper => paper.subject === subject);
  }
  
  if (category) {
    filtered = filtered.filter(paper => paper.category === category);
  }
  
  return filtered.sort((a, b) => {
    // 按年份和月份倒序排列
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
};

// 获取用户统计数据
export const getUserStats = () => {
  const totalPapers = examPapers.length;
  const completedPapers = examPapers.filter(p => p.status === 'completed').length;
  const inProgressPapers = examPapers.filter(p => p.status === 'in_progress').length;
  const totalQuestions = examPapers.reduce((sum, p) => sum + (p.completedCount || 0), 0);
  
  return {
    totalPapers,
    completedPapers,
    inProgressPapers,
    totalQuestions,
    accuracy: Math.round(Math.random() * 20 + 70) // 模拟正确率
  };
};