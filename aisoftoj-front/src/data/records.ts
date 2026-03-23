import { PracticeRecord, PracticeSessionRecord } from '../types/record';

// 模拟刷题会话记录数据
export const practiceSessionRecords: PracticeSessionRecord[] = [
  {
    id: 'ps001',
    examName: '2020年系统架构真题',
    examMode: 'exam',
    examType: '综合知识',
    createTime: '2025-10-12 15:47:50',
    answeredCount: 0,
    totalCount: 67,
    status: 'inProgress'
  },
  {
    id: 'ps002',
    examName: '24年11月系统架构真题',
    examMode: 'practice',
    examType: '综合知识',
    createTime: '2025-10-03 01:41:21',
    answeredCount: 0,
    totalCount: 76,
    status: 'inProgress'
  },
  {
    id: 'ps003',
    examName: '24年11月系统架构真题',
    examMode: 'practice',
    examType: '案例真题',
    createTime: '2025-10-03 01:01:27',
    answeredCount: 1,
    totalCount: 14,
    status: 'inProgress'
  },
  {
    id: 'ps004',
    examName: '2022年系统架构真题',
    examMode: 'practice',
    examType: '综合知识',
    createTime: '2025-10-03 00:56:18',
    answeredCount: 0,
    totalCount: 75,
    status: 'inProgress'
  },
  {
    id: 'ps005',
    examName: '2019年系统架构真题',
    examMode: 'practice',
    examType: '综合知识',
    createTime: '2025-10-02 17:46:49',
    answeredCount: 2,
    totalCount: 72,
    status: 'inProgress'
  },
  {
    id: 'ps006',
    examName: '24年5月系统架构真题',
    examMode: 'practice',
    examType: '案例真题',
    createTime: '2025-10-02 17:39:43',
    answeredCount: 1,
    totalCount: 13,
    status: 'inProgress'
  },
  {
    id: 'ps007',
    examName: '2021年系统架构真题',
    examMode: 'practice',
    examType: '综合知识',
    createTime: '2025-10-02 17:17:49',
    answeredCount: 0,
    totalCount: 73,
    status: 'inProgress'
  },
  {
    id: 'ps008',
    examName: '2023年系统架构真题',
    examMode: 'practice',
    examType: '综合知识',
    createTime: '2025-10-02 17:17:24',
    answeredCount: 0,
    totalCount: 65,
    status: 'inProgress'
  }
];

// 模拟错题记录数据（单个题目）
export const practiceRecords: PracticeRecord[] = [
  {
    id: 'pr001',
    topicName: '专业英语',
    questionBank: '24年11月系统架构真题',
    topicType: '单选题',
    errorCount: 2,
    updateTime: '2025-10-03 01:41:30',
    importance: 'low'
  },
  {
    id: 'pr002',
    topicName: '新技术应用',
    questionBank: '系统分析师 2024年11月 综合知识',
    topicType: '单选题',
    errorCount: 2,
    updateTime: '2025-07-11 20:57:25',
    importance: 'medium'
  },
  {
    id: 'pr003',
    topicName: '进度管理',
    questionBank: '2019年系统架构真题',
    topicType: '单选题',
    errorCount: 1,
    updateTime: '2025-10-15 01:26:14',
    importance: 'medium'
  },
  {
    id: 'pr004',
    topicName: '特殊数据库系统',
    questionBank: '2019年系统架构真题',
    topicType: '单选题',
    errorCount: 1,
    updateTime: '2025-10-15 01:16:03',
    importance: 'low'
  },
  {
    id: 'pr005',
    topicName: '信息安全基础知识',
    questionBank: '2019年系统架构真题',
    topicType: '单选题',
    errorCount: 1,
    updateTime: '2025-10-15 01:11:10',
    importance: 'must'
  },
  {
    id: 'pr006',
    topicName: '前趋图',
    questionBank: '2019年系统架构真题',
    topicType: '单选题',
    errorCount: 1,
    updateTime: '2025-10-12 18:29:13',
    importance: 'medium'
  },
  {
    id: 'pr007',
    topicName: '芯片温度等级',
    questionBank: '25年5月系统架构师真题',
    topicType: '单选题',
    errorCount: 1,
    updateTime: '2025-10-12 17:05:02',
    importance: 'high'
  },
  {
    id: 'pr008',
    topicName: '专业英语',
    questionBank: '24年11月系统架构真题',
    topicType: '单选题',
    errorCount: 1,
    updateTime: '2025-10-03 01:41:38',
    importance: 'low'
  },
  {
    id: 'pr009',
    topicName: '软件设计基础',
    questionBank: '24年11月系统架构真题',
    topicType: '单选题',
    errorCount: 3,
    updateTime: '2025-09-28 14:22:11',
    importance: 'high'
  },
  {
    id: 'pr010',
    topicName: '数据库优化',
    questionBank: '23年5月系统架构师真题',
    topicType: '单选题',
    errorCount: 2,
    updateTime: '2025-09-20 09:15:45',
    importance: 'medium'
  }
];

// 模拟错题记录数据
export const wrongQuestionRecords: PracticeRecord[] = [
  {
    id: 'wq001',
    topicName: '专业英语',
    questionBank: '24年11月系统架构真题',
    topicType: '单选题',
    errorCount: 2,
    updateTime: '2025-10-03 01:41:30',
    importance: 'low'
  },
  {
    id: 'wq002',
    topicName: '新技术应用',
    questionBank: '系统分析师 2024年11月 综合知识',
    topicType: '单选题',
    errorCount: 2,
    updateTime: '2025-07-11 20:57:25',
    importance: 'medium'
  },
  {
    id: 'wq003',
    topicName: '进度管理',
    questionBank: '2019年系统架构真题',
    topicType: '单选题',
    errorCount: 1,
    updateTime: '2025-10-15 01:26:14',
    importance: 'medium'
  },
  {
    id: 'wq004',
    topicName: '特殊数据库系统',
    questionBank: '2019年系统架构真题',
    topicType: '单选题',
    errorCount: 1,
    updateTime: '2025-10-15 01:16:03',
    importance: 'low'
  },
  {
    id: 'wq005',
    topicName: '信息安全基础知识',
    questionBank: '2019年系统架构真题',
    topicType: '单选题',
    errorCount: 1,
    updateTime: '2025-10-15 01:11:10',
    importance: 'must'
  },
  {
    id: 'wq006',
    topicName: '前趋图',
    questionBank: '2019年系统架构真题',
    topicType: '单选题',
    errorCount: 1,
    updateTime: '2025-10-12 18:29:13',
    importance: 'medium'
  },
  {
    id: 'wq007',
    topicName: '芯片温度等级',
    questionBank: '25年5月系统架构师真题',
    topicType: '单选题',
    errorCount: 1,
    updateTime: '2025-10-12 17:05:02',
    importance: 'high'
  },
  {
    id: 'wq008',
    topicName: '专业英语',
    questionBank: '24年11月系统架构真题',
    topicType: '单选题',
    errorCount: 1,
    updateTime: '2025-10-03 01:41:38',
    importance: 'low'
  }
];
