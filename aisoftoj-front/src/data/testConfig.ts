// 测试配置 - 快速开始刷题流程
import { ExamConfig } from '../types/exam';

// 预设的测试配置
export const testConfigs: ExamConfig[] = [
  {
    subject: '软件设计师',
    category: '计算机系统基础',
    questionCount: 10,
    timeLimit: 20, // 20分钟
    difficulty: 'medium',
    randomOrder: true,
    examMode: 'practice' // 练题模式，可以看到答案反馈
  },
  {
    subject: '软件设计师',
    category: '数据结构',
    questionCount: 8,
    timeLimit: 15,
    difficulty: 'hard',
    randomOrder: true,
    examMode: 'practice'
  },
  {
    subject: '系统架构设计师',
    category: '系统架构设计基础',
    questionCount: 12,
    timeLimit: 25,
    difficulty: 'hard',
    randomOrder: true,
    examMode: 'practice'
  },
  {
    subject: '数据库系统工程师',
    category: '数据库基础',
    questionCount: 6,
    timeLimit: 10,
    difficulty: 'easy',
    randomOrder: false,
    examMode: 'practice'
  },
  {
    subject: '网络工程师',
    category: '网络基础',
    questionCount: 8,
    timeLimit: 15,
    difficulty: 'medium',
    randomOrder: true,
    examMode: 'practice'
  },
  // 考试模式测试
  {
    subject: '软件设计师',
    category: '综合测试',
    questionCount: 15,
    timeLimit: 30,
    difficulty: 'medium',
    randomOrder: true,
    examMode: 'exam' // 考试模式，不显示答案
  }
];

// 快速开始测试的默认配置
export const getQuickTestConfig = (): ExamConfig => {
  return {
    subject: '软件设计师',
    category: '计算机系统基础',
    questionCount: 10,
    timeLimit: 20,
    difficulty: 'medium',
    randomOrder: true,
    examMode: 'practice'
  };
};

// 获取测试用的题目数量统计
export const getTestStats = () => {
  return {
    totalQuestions: 25, // 我们添加的测试题目总数
    subjects: ['软件设计师', '系统架构设计师', '数据库系统工程师', '网络工程师'],
    categories: [
      '计算机系统基础',
      '数据结构', 
      '算法设计',
      '软件工程',
      '计算机网络',
      '软件测试',
      '系统架构设计基础',
      '分布式系统',
      '数据库基础',
      'SQL语言',
      '数据库设计',
      '网络基础',
      '网络协议',
      '网络安全',
      '网络设备'
    ],
    questionTypes: ['single', 'multiple', 'judge', 'fill'],
    difficulties: ['easy', 'medium', 'hard']
  };
};

