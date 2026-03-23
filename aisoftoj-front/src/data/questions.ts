import { Question } from '../types/exam';
import { ExamPaper } from './examPapers';

// 软考题库数据
export const questionBank: Question[] = [
  // 软件设计师 - 计算机系统基础
  {
    id: 'sd001',
    type: 'single',
    subject: '软件设计师',
    category: '计算机系统基础',
    difficulty: 'medium',
    question: '在32位计算机系统中，若采用字节编址，则可访问的内存空间最大为（）。',
    options: ['2GB', '4GB', '8GB', '16GB'],
    correctAnswer: '4GB',
    explanation: '32位地址总线可以表示2^32个不同的地址，每个地址对应1字节，因此最大寻址空间为2^32字节=4GB。',
    year: 2023
  },
  {
    id: 'sd002',
    type: 'single',
    subject: '软件设计师',
    category: '计算机系统基础',
    difficulty: 'easy',
    question: 'CPU的组成包括（）。',
    options: ['运算器和控制器', '运算器和存储器', '控制器和存储器', '输入设备和输出设备'],
    correctAnswer: '运算器和控制器',
    explanation: 'CPU（中央处理器）主要由运算器（ALU）和控制器（CU）组成，负责执行指令和控制计算机各部件的工作。',
    year: 2023
  },
  {
    id: 'sd003',
    type: 'multiple',
    subject: '软件设计师',
    category: '操作系统',
    difficulty: 'medium',
    question: '操作系统的主要功能包括（）。',
    options: ['进程管理', '内存管理', '文件管理', '设备管理', '网络管理'],
    correctAnswer: ['进程管理', '内存管理', '文件管理', '设备管理'],
    explanation: '操作系统的四大主要功能是进程管理、内存管理、文件管理和设备管理。网络管理通常不被认为是操作系统的基本功能。',
    year: 2022
  },
  {
    id: 'sd004',
    type: 'judge',
    subject: '软件设计师',
    category: '数据结构',
    difficulty: 'easy',
    question: '栈是一种先进先出（FIFO）的数据结构。',
    options: ['正确', '错误'],
    correctAnswer: '错误',
    explanation: '栈是一种后进先出（LIFO）的数据结构，最后入栈的元素最先出栈。先进先出（FIFO）是队列的特性。',
    year: 2023
  },
  {
    id: 'sd005',
    type: 'single',
    subject: '软件设计师',
    category: '数据结构',
    difficulty: 'hard',
    question: '对于n个元素的完全二叉树，其叶子节点的个数为（）。',
    options: ['⌊n/2⌋', '⌈n/2⌉', '⌊(n+1)/2⌋', '⌈(n+1)/2⌉'],
    correctAnswer: '⌈n/2⌉',
    explanation: '在完全二叉树中，叶子节点个数等于⌈n/2⌉，其中n是总节点数。这可以通过数学归纳法证明。',
    year: 2022
  },
  
  // 系统架构设计师题目
  {
    id: 'sa001',
    type: 'single',
    subject: '系统架构设计师',
    category: '系统架构设计基础',
    difficulty: 'medium',
    question: '在微服务架构中，服务间通信常用的协议是（）。',
    options: ['HTTP/REST', 'RPC', '消息队列', '以上都是'],
    correctAnswer: '以上都是',
    explanation: '微服务架构中，服务间通信可以采用多种协议：HTTP/REST用于同步通信，RPC提供高性能调用，消息队列用于异步通信。',
    year: 2023
  },
  {
    id: 'sa002',
    type: 'multiple',
    subject: '系统架构设计师',
    category: '分布式系统',
    difficulty: 'hard',
    question: 'CAP定理中的三个要素包括（）。',
    options: ['一致性(Consistency)', '可用性(Availability)', '分区容错性(Partition tolerance)', '性能(Performance)', '扩展性(Scalability)'],
    correctAnswer: ['一致性(Consistency)', '可用性(Availability)', '分区容错性(Partition tolerance)'],
    explanation: 'CAP定理指出分布式系统只能同时保证一致性、可用性、分区容错性中的两个，无法三者兼得。',
    year: 2022
  },

  // 数据库系统工程师题目
  {
    id: 'db001',
    type: 'single',
    subject: '数据库系统工程师',
    category: '数据库基础',
    difficulty: 'medium',
    question: '关系数据库中，外键的作用是（）。',
    options: ['确保数据唯一性', '维护参照完整性', '提高查询性能', '减少存储空间'],
    correctAnswer: '维护参照完整性',
    explanation: '外键用于维护两个表之间的参照完整性，确保子表中的外键值必须在父表的主键中存在，或者为空值。',
    year: 2023
  },
  {
    id: 'db002',
    type: 'single',
    subject: '数据库系统工程师',
    category: 'SQL语言',
    difficulty: 'easy',
    question: '在SQL中，用于删除表中所有记录但保留表结构的语句是（）。',
    options: ['DROP TABLE', 'DELETE FROM', 'TRUNCATE TABLE', 'ALTER TABLE'],
    correctAnswer: 'TRUNCATE TABLE',
    explanation: 'TRUNCATE TABLE语句用于删除表中的所有行，但保留表结构。相比DELETE FROM，TRUNCATE执行更快且不能回滚。',
    year: 2023
  },

  // 更多测试题目 - 软件设计师
  {
    id: 'sd006',
    type: 'single',
    subject: '软件设计师',
    category: '数据结构',
    difficulty: 'hard',
    question: '在一个有n个节点的完全二叉树中，叶子节点的个数是（）。',
    options: ['n/2', '⌈n/2⌉', '⌊n/2⌋', 'n-1'],
    correctAnswer: '⌈n/2⌉',
    explanation: '在完全二叉树中，叶子节点个数等于⌈n/2⌉，其中n是总节点数。这是完全二叉树的一个重要性质。',
    year: 2023
  },
  {
    id: 'sd007',
    type: 'multiple',
    subject: '软件设计师',
    category: '算法设计',
    difficulty: 'medium',
    question: '以下哪些是常见的时间复杂度（）。',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)', 'O(2ⁿ)'],
    correctAnswer: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
    explanation: '常见的时间复杂度包括：O(1)常数时间、O(log n)对数时间、O(n)线性时间、O(n²)平方时间。O(2ⁿ)指数时间虽然存在但通常不认为是"常见"的。',
    year: 2023
  },
  {
    id: 'sd008',
    type: 'judge',
    subject: '软件设计师',
    category: '软件工程',
    difficulty: 'easy',
    question: '敏捷开发强调文档的重要性胜过代码的可读性。',
    options: ['正确', '错误'],
    correctAnswer: '错误',
    explanation: '敏捷开发强调"工作的软件胜过详尽的文档"，更注重代码的可读性和可维护性，而不是过度的文档。',
    year: 2023
  },
  {
    id: 'sd009',
    type: 'fill',
    subject: '软件设计师',
    category: '计算机网络',
    difficulty: 'medium',
    question: 'HTTP协议默认使用的端口号是（）。',
    options: [],
    correctAnswer: '80',
    explanation: 'HTTP协议默认使用80端口，HTTPS协议默认使用443端口。',
    year: 2023
  },
  {
    id: 'sd010',
    type: 'single',
    subject: '软件设计师',
    category: '软件测试',
    difficulty: 'medium',
    question: '以下哪种测试方法属于黑盒测试（）。',
    options: ['单元测试', '集成测试', '等价类划分', '代码审查'],
    correctAnswer: '等价类划分',
    explanation: '等价类划分是黑盒测试的一种方法，不需要了解程序内部结构，只根据输入输出规格进行测试。',
    year: 2023
  },

  // 系统架构设计师测试题目
  {
    id: 'sa003',
    type: 'single',
    subject: '系统架构设计师',
    category: '系统架构设计基础',
    difficulty: 'hard',
    question: '在微服务架构中，服务发现的主要作用是（）。',
    options: ['负载均衡', '服务注册与发现', '数据存储', '安全认证'],
    correctAnswer: '服务注册与发现',
    explanation: '服务发现是微服务架构中的核心组件，负责服务的注册、发现和路由，使得服务之间能够相互通信。',
    year: 2023
  },
  {
    id: 'sa004',
    type: 'multiple',
    subject: '系统架构设计师',
    category: '分布式系统',
    difficulty: 'hard',
    question: '分布式系统中的一致性模型包括（）。',
    options: ['强一致性', '弱一致性', '最终一致性', '因果一致性', '线性一致性'],
    correctAnswer: ['强一致性', '弱一致性', '最终一致性', '因果一致性'],
    explanation: '分布式系统的一致性模型主要包括强一致性、弱一致性、最终一致性和因果一致性。线性一致性是强一致性的一种特殊情况。',
    year: 2023
  },
  {
    id: 'sa005',
    type: 'judge',
    subject: '系统架构设计师',
    category: '系统架构设计基础',
    difficulty: 'medium',
    question: 'SOA（面向服务架构）和微服务架构是相同的概念。',
    options: ['正确', '错误'],
    correctAnswer: '错误',
    explanation: 'SOA和微服务架构虽然都强调服务化，但微服务是SOA的一种演进形式，更强调服务的细粒度、独立部署和去中心化治理。',
    year: 2023
  },

  // 数据库系统工程师测试题目
  {
    id: 'db003',
    type: 'single',
    subject: '数据库系统工程师',
    category: '数据库基础',
    difficulty: 'medium',
    question: '在关系数据库中，第三范式（3NF）要求（）。',
    options: ['消除部分函数依赖', '消除传递函数依赖', '消除多值依赖', '消除冗余数据'],
    correctAnswer: '消除传递函数依赖',
    explanation: '第三范式（3NF）要求消除传递函数依赖，即非主属性不能依赖于其他非主属性。',
    year: 2023
  },
  {
    id: 'db004',
    type: 'multiple',
    subject: '数据库系统工程师',
    category: '数据库设计',
    difficulty: 'medium',
    question: '数据库索引的类型包括（）。',
    options: ['B+树索引', '哈希索引', '位图索引', '全文索引', '聚簇索引'],
    correctAnswer: ['B+树索引', '哈希索引', '位图索引', '全文索引'],
    explanation: '常见的数据库索引类型包括B+树索引、哈希索引、位图索引和全文索引。聚簇索引是B+树索引的一种特殊形式。',
    year: 2023
  },
  {
    id: 'db005',
    type: 'judge',
    subject: '数据库系统工程师',
    category: 'SQL语言',
    difficulty: 'easy',
    question: '在SQL中，GROUP BY子句必须与聚合函数一起使用。',
    options: ['正确', '错误'],
    correctAnswer: '正确',
    explanation: 'GROUP BY子句用于对查询结果进行分组，通常与聚合函数（如COUNT、SUM、AVG等）一起使用，对每个分组进行统计计算。',
    year: 2023
  },
  {
    id: 'db006',
    type: 'fill',
    subject: '数据库系统工程师',
    category: '数据库基础',
    difficulty: 'medium',
    question: 'ACID特性中的A代表（）。',
    options: [],
    correctAnswer: '原子性',
    explanation: 'ACID特性包括：A-原子性（Atomicity）、C-一致性（Consistency）、I-隔离性（Isolation）、D-持久性（Durability）。',
    year: 2023
  },

  // 网络工程师测试题目
  {
    id: 'ne001',
    type: 'single',
    subject: '网络工程师',
    category: '网络基础',
    difficulty: 'easy',
    question: 'OSI七层模型中，传输层对应的是（）。',
    options: ['第3层', '第4层', '第5层', '第6层'],
    correctAnswer: '第4层',
    explanation: 'OSI七层模型中，传输层是第4层，负责端到端的数据传输，主要协议有TCP和UDP。',
    year: 2023
  },
  {
    id: 'ne002',
    type: 'multiple',
    subject: '网络工程师',
    category: '网络协议',
    difficulty: 'medium',
    question: '以下哪些是TCP协议的特点（）。',
    options: ['面向连接', '可靠传输', '无连接', '流量控制', '拥塞控制'],
    correctAnswer: ['面向连接', '可靠传输', '流量控制', '拥塞控制'],
    explanation: 'TCP协议的特点包括面向连接、可靠传输、流量控制和拥塞控制。UDP协议才是无连接的。',
    year: 2023
  },
  {
    id: 'ne003',
    type: 'judge',
    subject: '网络工程师',
    category: '网络安全',
    difficulty: 'medium',
    question: '防火墙只能阻止外部网络对内部网络的攻击。',
    options: ['正确', '错误'],
    correctAnswer: '错误',
    explanation: '防火墙可以双向工作，既能阻止外部网络对内部网络的攻击，也能控制内部网络对外部网络的访问。',
    year: 2023
  },
  {
    id: 'ne004',
    type: 'single',
    subject: '网络工程师',
    category: '网络设备',
    difficulty: 'medium',
    question: '交换机工作在OSI模型的（）。',
    options: ['物理层', '数据链路层', '网络层', '传输层'],
    correctAnswer: '数据链路层',
    explanation: '交换机主要工作在OSI模型的数据链路层（第2层），通过MAC地址进行数据转发。',
    year: 2023
  },
  {
    id: 'ne005',
    type: 'fill',
    subject: '网络工程师',
    category: '网络基础',
    difficulty: 'easy',
    question: 'IPv4地址的长度是（）位。',
    options: [],
    correctAnswer: '32',
    explanation: 'IPv4地址使用32位二进制数表示，通常用点分十进制表示法，如192.168.1.1。',
    year: 2023
  }
];

// 按科目分组的题目
export const questionsBySubject = questionBank.reduce((acc, question) => {
  if (!acc[question.subject]) {
    acc[question.subject] = [];
  }
  acc[question.subject].push(question);
  return acc;
}, {} as Record<string, Question[]>);

// 获取科目列表
export const subjects = Object.keys(questionsBySubject);

// 获取指定科目的分类
export const getCategoriesBySubject = (subject: string): string[] => {
  const questions = questionsBySubject[subject] || [];
  return [...new Set(questions.map(q => q.category))];
};

// 根据条件筛选题目
export const filterQuestions = (
  subject?: string,
  category?: string,
  difficulty?: string,
  count?: number
): Question[] => {
  let filtered = questionBank;
  
  if (subject) {
    filtered = filtered.filter(q => q.subject === subject);
  }
  
  if (category) {
    filtered = filtered.filter(q => q.category === category);
  }
  
  if (difficulty) {
    filtered = filtered.filter(q => q.difficulty === difficulty);
  }
  
  // 随机排序
  filtered = filtered.sort(() => Math.random() - 0.5);
  
  if (count && count > 0) {
    filtered = filtered.slice(0, count);
  }
  
  return filtered;
};

// 根据试卷获取题目
export const getQuestionsByPaper = (paper: ExamPaper): Question[] => {
  // 为每个试卷生成对应的题目
  const questions: Question[] = [];
  
  for (let i = 1; i <= paper.questionCount; i++) {
    questions.push({
      id: `${paper.id}-q${i}`,
      type: 'single', // 只使用单选题
      subject: paper.subject,
      category: paper.category,
      difficulty: Math.random() > 0.7 ? 'hard' : Math.random() > 0.4 ? 'medium' : 'easy',
      question: `${paper.year}年${paper.month}月${paper.subject}${paper.category}第${i}题：以下哪项是正确的？`,
      options: ['选项A', '选项B', '选项C', '选项D'],
      correctAnswer: '选项A',
      explanation: `这是第${i}题的详细解析，正确答案是选项A。`,
      year: paper.year
    });
  }
  
  return questions;
};