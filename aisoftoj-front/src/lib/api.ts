import { ExamPaper } from '../data/examPapers';
import { ExamSession, Question } from '../types/exam';
import { PracticeRecord, PracticeSessionRecord } from '../types/record';
import { LoginForm, RegisterForm, User } from '../types/user';

const API_BASE_URL = 'http://localhost:8080';

type ApiResult<T> = {
  code: number;
  message: string;
  data: T;
  timestamp: number;
};

type ApiError = {
  code?: number;
  message?: string;
  path?: string;
  timestamp?: number;
};

type PaperDTO = {
  id: number;
  subjectName?: string;
  paperCateId: number;
  paperYear?: number;
  paperMonth?: number;
  questionTotal: number;
  readCt: number;
  doingSessionId?: number | null;
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

type AuthUserDTO = User;

type AuthResponse = {
  token: string;
  user: AuthUserDTO;
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

function mapQuestion(question: BackendQuestionDTO, paperCateId = 1): Question {
  const isMarkdown = paperCateId === 2 || paperCateId === 3;
  const type = isMarkdown ? 'essay' : mapQuestionType(question.questionType);
  return {
    id: String(question.id),
    type,
    subject: '',
    category: '',
    difficulty: mapDifficulty(question.difficulty),
    question: question.intro || question.name,
    isMarkdown,
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

  const payload = await response.json().catch(() => null as ApiResult<T> | ApiError | null);

  if (!response.ok) {
    const errorPayload = payload as ApiError | null;
    throw new Error(errorPayload?.message || `请求失败: ${response.status}`);
  }

  const result = payload as ApiResult<T>;
  if (!result || result.code !== 200) {
    throw new Error((payload as ApiError | null)?.message || result?.message || '请求失败');
  }
  return result.data;
}

export async function loginByEmail(form: LoginForm): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: form.email,
      password: form.password,
    }),
  });
}

export async function registerByEmail(form: RegisterForm): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(form),
  });
}

export async function fetchCurrentUser(token: string): Promise<User> {
  return request<User>('/auth/me', {
    headers: {
      Authorization: token,
    },
  });
}

export async function logoutAuth(token: string): Promise<void> {
  await request('/auth/logout', {
    method: 'POST',
    headers: {
      Authorization: token,
    },
  });
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
    doingSessionId: paper.doingSessionId ? String(paper.doingSessionId) : null,
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
    questions: data.questionList.map(q => mapQuestion(q, data.paper?.paperCateId ?? 1)),
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
    questions: data.questionList.map(q => mapQuestion(q, data.paper?.paperCateId ?? 1)),
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
