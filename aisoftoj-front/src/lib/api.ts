import { ExamPaper } from '../data/examPapers';
import { ExamSession, Question } from '../types/exam';
import { PracticeRecord, PracticeSessionRecord } from '../types/record';

const API_BASE_URL = 'http://localhost:8080';

type ApiResult<T> = {
  code: number;
  message: string;
  data: T;
  timestamp: number;
};

type PaperDTO = {
  id: number;
  subjectName?: string;
  paperCateId: number;
  paperYear?: number;
  paperMonth?: number;
  questionTotal: number;
  readCt: number;
  paperStatus?: 'not_started' | 'in_progress' | 'completed';
  progress?: number;
  completedCount?: number;
  updateTime?: string;
};

type BackendOption = {
  keyStr: string;
  valueStr: string;
  orderNum: number;
};

type BackendQuestionDTO = {
  id: number;
  name: string;
  intro: string;
  options: BackendOption[];
  answer: string;
  analysis: string;
  questionType: number;
  difficulty: number;
};

type StartSessionRes = {
  practiceSessionId: number;
  paperId: number;
  paperName: string;
  paper?: {
    subjectName?: string;
    paperCateId?: number;
    questionTotal?: number;
  };
  questionList: BackendQuestionDTO[];
};

type GetSessionRes = {
  id: number;
  paperId: number;
  paperName: string;
  paper?: {
    subjectName?: string;
    paperCateId?: number;
  };
  questionList: BackendQuestionDTO[];
};

function mapPaperCate(cateId: number): ExamPaper['category'] {
  switch (cateId) {
    case 2:
      return '案例分析';
    case 3:
      return '论文';
    default:
      return '综合知识';
  }
}

function mapQuestionType(type: number): Question['type'] {
  switch (type) {
    case 2:
      return 'multiple';
    case 3:
      return 'judge';
    case 4:
      return 'fill';
    default:
      return 'single';
  }
}

function mapDifficulty(difficulty: number): Question['difficulty'] {
  switch (difficulty) {
    case 1:
      return 'easy';
    case 3:
      return 'hard';
    default:
      return 'medium';
  }
}

function parseCorrectAnswer(answer: string, type: Question['type']): string | string[] {
  if (type === 'multiple') {
    return answer.split(',').map(item => item.trim()).filter(Boolean);
  }
  return answer;
}

function extractQuestionTitle(intro: string, fallback: string): string {
  const firstLine = intro?.split('\n')[0]?.trim();
  return firstLine || fallback;
}

function mapQuestion(question: BackendQuestionDTO): Question {
  const type = mapQuestionType(question.questionType);
  return {
    id: String(question.id),
    type,
    subject: '',
    category: '',
    difficulty: mapDifficulty(question.difficulty),
    question: extractQuestionTitle(question.intro, question.name),
    options: question.options?.map(option => option.valueStr) ?? [],
    correctAnswer: parseCorrectAnswer(question.answer, type),
    explanation: question.analysis || '',
  };
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`);
  }

  const result: ApiResult<T> = await response.json();
  if (result.code !== 200) {
    throw new Error(result.message || '请求失败');
  }
  return result.data;
}

export async function fetchPapers(): Promise<ExamPaper[]> {
  const papers = await request<PaperDTO[]>('/paper/list');
  return papers.map((paper) => ({
    id: String(paper.id),
    year: paper.paperYear || 0,
    month: paper.paperMonth || 0,
    subject: paper.subjectName || '系统架构设计师',
    category: mapPaperCate(paper.paperCateId),
    questionCount: paper.questionTotal || 0,
    lastUpdated: paper.updateTime || '',
    viewCount: paper.readCt || 0,
    status: paper.paperStatus || 'not_started',
    completedCount: paper.completedCount ?? paper.progress ?? 0,
  }));
}

export async function startPaperSession(
  paperId: string,
  examMode: ExamSession['examMode'] = 'practice'
): Promise<ExamSession> {
  const data = await request<StartSessionRes>('/session/start', {
    method: 'POST',
    body: JSON.stringify({
      paperId: Number(paperId),
      mode: examMode === 'exam' ? 2 : 1,
    }),
  });

  return {
    id: String(data.practiceSessionId),
    paperId: String(data.paperId),
    paperName: data.paperName,
    subject: data.paper?.subjectName || data.paperName,
    category: mapPaperCate(data.paper?.paperCateId || 1),
    questions: data.questionList.map(mapQuestion),
    answers: {},
    startTime: new Date(),
    isCompleted: false,
    examMode,
  };
}

export async function fetchPracticeHistory(): Promise<PracticeSessionRecord[]> {
  return request<PracticeSessionRecord[]>('/session/history');
}

export async function fetchWrongQuestions(): Promise<PracticeRecord[]> {
  return request<PracticeRecord[]>('/wrong-questions');
}

export async function continuePracticeSession(sessionId: string): Promise<ExamSession> {
  const data = await request<GetSessionRes>(`/session/${sessionId}`);
  return {
    id: String(data.id),
    paperId: String(data.paperId),
    paperName: data.paperName,
    subject: data.paper?.subjectName || data.paperName,
    category: mapPaperCate(data.paper?.paperCateId || 1),
    questions: data.questionList.map(mapQuestion),
    answers: {},
    startTime: new Date(),
    isCompleted: false,
    examMode: 'practice',
  };
}

export async function submitPracticeSession(
  sessionId: string,
  answers: Record<string, string | string[]>
): Promise<void> {
  await request(`/session/submit/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({
      endTime: new Date().toISOString(),
      answers: Object.entries(answers).map(([questionId, userAnswer]) => ({
        questionId: Number(questionId),
        userAnswer: Array.isArray(userAnswer) ? userAnswer.join(',') : userAnswer,
        spendTime: 0,
      })),
    }),
  });
}
