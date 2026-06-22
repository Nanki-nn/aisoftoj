import { ExamPaper } from '../data/examPapers';
import { ExamSession, Question, QuestionOption } from '../types/exam';
import { PageResult, PracticeRecord, PracticeSessionRecord } from '../types/record';
import { LoginForm, RegisterForm, User } from '../types/user';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:8080' : '');

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

type PageQuery = {
  page?: number;
  pageSize?: number;
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
  key?: string;
  text?: string;
  correct?: boolean;
  keyStr?: string;
  valueStr?: string;
  orderNum?: number;
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
  questionRecordId?: number | null;
  userAnswer?: string | null;
  isSubmitted?: boolean | null;
  isCorrect?: boolean | null;
  spendTime?: number | null;
};

type StartSessionRes = {
  practiceSessionId: number;
  paperId: number;
  paperName: string;
  status?: number;
  startTime?: string | number;
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
  examMode?: string;
  status?: number;
  startTime?: string | number;
  endTime?: string | number;
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

function parseUserAnswer(answer: string | null | undefined, type: Question['type']): string | string[] | undefined {
  if (!answer || !answer.trim()) {
    return undefined;
  }
  if (type === 'multiple') {
    return answer.split(',').map(item => item.trim()).filter(Boolean);
  }
  return answer.trim();
}

function parseOptionPayload(rawValue?: string): Partial<QuestionOption> | null {
  if (!rawValue) {
    return null;
  }

  try {
    const payload = JSON.parse(rawValue);
    if (payload && typeof payload === 'object') {
      return {
        key: typeof payload.key === 'string' ? payload.key : undefined,
        text: typeof payload.text === 'string' ? payload.text : undefined,
        correct: typeof payload.correct === 'boolean' ? payload.correct : undefined,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function mapOption(option: BackendOption, index: number): QuestionOption {
  const nestedOption = parseOptionPayload(option.valueStr || option.text);
  const fallbackKey = String.fromCharCode(65 + index);
  const key = nestedOption?.key || option.keyStr || option.key || fallbackKey;
  const text = nestedOption?.text || option.valueStr || option.text || '';

  return {
    key,
    text,
    correct: nestedOption?.correct ?? option.correct,
  };
}

function normalizeAnswerValue(answer: string): string {
  return parseOptionPayload(answer)?.key || answer;
}

function mapQuestion(question: BackendQuestionDTO, paperCateId = 1): Question {
  const isMarkdown = paperCateId === 2 || paperCateId === 3;
  const type = isMarkdown ? 'essay' : mapQuestionType(question.questionType);
  const userAnswer = parseUserAnswer(question.userAnswer, type);
  return {
    id: String(question.id),
    type,
    subject: '',
    category: '',
    difficulty: mapDifficulty(question.difficulty),
    question: question.intro || question.name,
    isMarkdown,
    options: question.options?.map(mapOption) ?? [],
    correctAnswer: parseCorrectAnswer(question.answer, type),
    explanation: question.analysis || '',
    questionRecordId: question.questionRecordId ? String(question.questionRecordId) : undefined,
    userAnswer,
    isSubmitted: question.isSubmitted ?? undefined,
    isCorrect: question.isCorrect ?? undefined,
    spendTime: question.spendTime ?? undefined,
  };
}

function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

function buildAnswersFromQuestions(questions: Question[]): Record<string, string | string[]> {
  return questions.reduce<Record<string, string | string[]>>((answers, question) => {
    if (question.userAnswer !== undefined && !(Array.isArray(question.userAnswer) && question.userAnswer.length === 0)) {
      answers[question.id] = question.userAnswer;
    }
    return answers;
  }, {});
}

const SESSION_ANSWER_CACHE_PREFIX = 'aisoftoj:session-answers:';

function getSessionAnswerCacheKey(sessionId: string): string {
  return `${SESSION_ANSWER_CACHE_PREFIX}${sessionId}`;
}

function readCachedSessionAnswers(sessionId: string): Record<string, string | string[]> {
  try {
    const raw = localStorage.getItem(getSessionAnswerCacheKey(sessionId));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function buildSessionAnswers(sessionId: string, questions: Question[]): Record<string, string | string[]> {
  return {
    ...readCachedSessionAnswers(sessionId),
    ...buildAnswersFromQuestions(questions),
  };
}

export function cachePracticeSessionAnswers(
  sessionId: string,
  answers: Record<string, string | string[]>
): void {
  try {
    localStorage.setItem(getSessionAnswerCacheKey(sessionId), JSON.stringify(answers));
  } catch {
    // localStorage may be unavailable in private modes; backend persistence still handles normal cases.
  }
}

function mapExamMode(mode?: string): ExamSession['examMode'] {
  return mode === 'exam' || mode === '2' ? 'exam' : 'practice';
}

function parseServerDate(value?: string | number): Date | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const authToken = localStorage.getItem('authToken');
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (authToken && !(init?.headers && new Headers(init.headers).has('Authorization'))) {
    defaultHeaders.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...defaultHeaders,
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
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function logoutAuth(token: string): Promise<void> {
  await request('/auth/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
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
    practiceCount: paper.readCt || 0,
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
  const questions = data.questionList.map(q => mapQuestion(q, data.paper?.paperCateId ?? 1));
  const sessionId = String(data.practiceSessionId);

  return {
    id: sessionId,
    paperId: String(data.paperId),
    paperName: data.paperName,
    subject: data.paper?.subjectName || data.paperName,
    category: mapPaperCate(data.paper?.paperCateId || 1),
    questions,
    answers: buildSessionAnswers(sessionId, questions),
    startTime: parseServerDate(data.startTime) || new Date(),
    isCompleted: data.status === 1,
    examMode,
  };
}

export async function fetchPracticeHistory(params: PageQuery = {}): Promise<PageResult<PracticeSessionRecord>> {
  return request<PageResult<PracticeSessionRecord>>(
    `/session/history${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
    })}`
  );
}

export async function fetchWrongQuestions(params: PageQuery = {}): Promise<PageResult<PracticeRecord>> {
  return request<PageResult<PracticeRecord>>(
    `/wrong-questions${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
    })}`
  );
}

export type WrongQuestionEvidence = {
  questionId?: number | null;
  questionName: string;
  knowledgePointName: string;
  subjectName?: string | null;
  paperName?: string | null;
  questionType?: string | null;
  difficulty?: number | null;
  paperYear?: number | null;
  errorCount: number;
  importanceLevel?: string | null;
  lastWrongTime?: string | null;
};

export type KnowledgePointRecommendation = {
  id: string;
  name: string;
  subject: string;
  category: string;
  score: number;
  mastery: number;
  errorCount: number;
  wrongQuestionCount: number;
  level: 'low' | 'medium' | 'high' | 'must';
  reason: string;
  suggestion: string;
  prerequisiteNames: string[];
  relatedNames: string[];
  evidences: WrongQuestionEvidence[];
};

export type KnowledgeGraphNode = {
  id: string;
  label: string;
  type: 'knowledge' | 'related' | 'question' | string;
  score: number;
  mastery: number;
  errorCount: number;
  properties?: Record<string, unknown>;
};

export type KnowledgeGraphEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
  weight: number;
  evidence?: string;
  sourceType?: string;
  properties?: Record<string, unknown>;
};

export type KnowledgeGraph = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  graphAvailable: boolean;
  source: string;
};

export async function fetchKnowledgePointRecommendations(signal?: AbortSignal): Promise<KnowledgePointRecommendation[]> {
  return request<KnowledgePointRecommendation[]>('/recommendations/knowledge-points', { signal });
}

export type KnowledgeGraphScope = 'focus' | 'full';

export async function fetchKnowledgeGraph(
  scope: KnowledgeGraphScope = 'focus',
  signal?: AbortSignal
): Promise<KnowledgeGraph> {
  return request<KnowledgeGraph>(`/recommendations/knowledge-graph?scope=${scope}`, { signal });
}

export async function updateKnowledgeGraphNode(
  nodeId: string,
  data: { label: string }
): Promise<KnowledgeGraph> {
  return request<KnowledgeGraph>(`/recommendations/knowledge-graph/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function updateKnowledgeGraphEdge(
  edgeId: string,
  data: { type: string; label: string; weight: number }
): Promise<KnowledgeGraph> {
  return request<KnowledgeGraph>(`/recommendations/knowledge-graph/edges/${encodeURIComponent(edgeId)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteKnowledgeGraphEdge(edgeId: string): Promise<KnowledgeGraph> {
  return request<KnowledgeGraph>(`/recommendations/knowledge-graph/edges/${encodeURIComponent(edgeId)}`, {
    method: 'DELETE',
  });
}

export async function continuePracticeSession(sessionId: string): Promise<ExamSession> {
  const data = await request<GetSessionRes>(`/session/${sessionId}`);
  const questions = data.questionList.map(q => mapQuestion(q, data.paper?.paperCateId ?? 1));
  const isCompleted = data.status === 1;
  const resolvedSessionId = String(data.id);
  return {
    id: resolvedSessionId,
    paperId: String(data.paperId),
    paperName: data.paperName,
    subject: data.paper?.subjectName || data.paperName,
    category: mapPaperCate(data.paper?.paperCateId || 1),
    questions,
    answers: buildSessionAnswers(resolvedSessionId, questions),
    startTime: parseServerDate(data.startTime) || new Date(),
    endTime: parseServerDate(data.endTime),
    isCompleted,
    examMode: mapExamMode(data.examMode),
  };
}

export async function updatePracticeQuestionRecord(
  questionRecordId: string,
  userAnswer: string | string[],
  spendTime = 0
): Promise<void> {
  await request(`/practice/session/question/record/${questionRecordId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      userAnswer: Array.isArray(userAnswer)
        ? userAnswer.map(normalizeAnswerValue).join(',')
        : normalizeAnswerValue(userAnswer),
      spendTime,
    }),
  });
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
        userAnswer: Array.isArray(userAnswer)
          ? userAnswer.map(normalizeAnswerValue).join(',')
          : normalizeAnswerValue(userAnswer),
        spendTime: 0,
      })),
    }),
  });
}

// ─── Essay API ────────────────────────────────────────────────────────────────

export type EssayQuestion = {
  id: number;
  name: string;
  intro: string;
  year: number | null;
  subjectName: string | null;
};

export type EssayResultData = {
  submissionId: number;
  status: number;
  totalScore: number;
  scoreAbstract: number;
  scoreStructure: number;
  scoreRelevance: number;
  scoreDepth: number;
  scoreEvidence: number;
  scoreLanguage: number;
  suggestions: string[];
};

export type EssayHistoryItem = {
  submissionId: number;
  questionId: number;
  questionTitle: string;
  wordCount: number;
  totalScore: number;
  status: number;
  createTime: string;
};

function getAuthToken(): string {
  return localStorage.getItem('authToken') || '';
}

export async function getEssayQuestions(subject?: string): Promise<EssayQuestion[]> {
  const path = subject
    ? `/essay/questions?subject=${encodeURIComponent(subject)}`
    : '/essay/questions';
  return request<EssayQuestion[]>(path);
}

export async function submitEssay(
  questionId: number,
  abstractText: string,
  content: string
): Promise<{ submissionId: number }> {
  return request<{ submissionId: number }>('/essay/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getAuthToken()}` },
    body: JSON.stringify({ questionId, abstractText, content }),
  });
}

export async function getEssayResult(submissionId: string): Promise<EssayResultData> {
  return request<EssayResultData>(`/essay/result/${submissionId}`, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
}

export async function getEssayHistory(): Promise<EssayHistoryItem[]> {
  return request<EssayHistoryItem[]>('/essay/history', {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
}

// ─── Admin API ─────────────────────────────────────────────────────────────────

export type AdminDashboardDTO = {
  userTotal: number;
  enabledUserTotal: number;
  questionTotal: number;
  activeQuestionTotal: number;
};

export type AdminUserDTO = {
  id: number;
  loginName: string;
  nickName: string;
  email: string;
  phone: string;
  avatar: string;
  isEnabled: boolean;
  createTime: string;
  updateTime: string;
  sessionCount: number;
  wrongQuestionCount: number;
};

export type AdminUserUpdateRequest = {
  loginName?: string;
  nickName?: string;
  email?: string;
  phone?: string;
  isEnabled?: boolean;
};

export type AdminQuestionDTO = {
  id: number;
  name: string;
  intro: string;
  options: string;
  answer: string;
  analysis: string;
  questionType: number;
  difficulty: number;
  readCt: number;
  createTime: string;
  updateTime: string;
  subjectName: string | null;
  paperYear: number | null;
  paperMonth: number | null;
  paperCateId: number | null;
};

export type AdminQuestionRequest = {
  name: string;
  intro?: string;
  options?: string;
  answer: string;
  analysis?: string;
  questionType: number;
  difficulty: number;
};

export type AdminPageDTO<T> = {
  records: T[];
  total: number;
  page: number;
  pageSize: number;
};

export async function fetchAdminDashboard(): Promise<AdminDashboardDTO> {
  return request<AdminDashboardDTO>('/admin/dashboard');
}

export async function listAdminUsers(params: {
  keyword?: string;
  enabled?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<AdminPageDTO<AdminUserDTO>> {
  return request<AdminPageDTO<AdminUserDTO>>(
    `/admin/users${buildQueryString({
      keyword: params.keyword,
      enabled: params.enabled,
      page: params.page,
      pageSize: params.pageSize,
    })}`
  );
}

export async function updateAdminUser(
  userId: number,
  data: AdminUserUpdateRequest
): Promise<AdminUserDTO> {
  return request<AdminUserDTO>(`/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteAdminUser(userId: number): Promise<void> {
  await request(`/admin/users/${userId}`, { method: 'DELETE' });
}

export async function listAdminQuestions(params: {
  keyword?: string;
  questionType?: number;
  difficulty?: number;
  subjectName?: string;
  year?: number;
  month?: number;
  paperCateId?: number;
  page?: number;
  pageSize?: number;
}): Promise<AdminPageDTO<AdminQuestionDTO>> {
  return request<AdminPageDTO<AdminQuestionDTO>>(
    `/admin/questions${buildQueryString({
      keyword: params.keyword,
      questionType: params.questionType,
      difficulty: params.difficulty,
      subjectName: params.subjectName,
      year: params.year,
      month: params.month,
      paperCateId: params.paperCateId,
      page: params.page,
      pageSize: params.pageSize,
    })}`
  );
}

export async function createAdminQuestion(data: AdminQuestionRequest): Promise<AdminQuestionDTO> {
  return request<AdminQuestionDTO>('/admin/questions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAdminQuestion(
  questionId: number,
  data: AdminQuestionRequest
): Promise<AdminQuestionDTO> {
  return request<AdminQuestionDTO>(`/admin/questions/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteAdminQuestion(questionId: number): Promise<void> {
  await request(`/admin/questions/${questionId}`, { method: 'DELETE' });
}

export async function fetchAdminSubjects(): Promise<string[]> {
  return request<string[]>('/admin/questions/subjects');
}

export async function fetchAdminYears(): Promise<number[]> {
  return request<number[]>('/admin/questions/years');
}

export async function fetchAdminMonths(): Promise<number[]> {
  return request<number[]>('/admin/questions/months');
}

// ─── OSS API ───────────────────────────────────────────────────────────────────

export async function uploadOssFile(file: File, dir?: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  if (dir) formData.append('dir', dir);

  const authToken = localStorage.getItem('authToken');
  const response = await fetch(`${API_BASE_URL}/oss/upload`, {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.code !== 200) {
    throw new Error(payload?.message || `上传失败: ${response.status}`);
  }
  return payload.data as string;
}

// AI Chat API
export type AiChatCitation = {
  index: number;
  result_id: string;
  title: string;
  source: string;
  content: string;
  score: number;
  document_id?: string | null;
  version?: number | null;
  content_type?: 'text' | 'table' | 'formula' | 'image' | 'web';
  asset_name?: string | null;
  page?: number | null;
  heading_path?: string[];
  url?: string | null;
  asset_url?: string | null;
};

export type AiChatAgentEvent = {
  type: 'agent_action' | 'tool_result' | 'memory_update';
  title: string;
  message: string;
};

export async function loadKnowledgeCitationAsset(
  documentId: string,
  version: number,
  filename: string
): Promise<string> {
  const authToken = localStorage.getItem('authToken');
  const response = await fetch(
    `${API_BASE_URL}/knowledge/documents/external/${encodeURIComponent(documentId)}` +
      `/versions/${version}/assets/${encodeURIComponent(filename)}`,
    {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    }
  );
  if (!response.ok) throw new Error('图片资源加载失败');
  return URL.createObjectURL(await response.blob());
}

export type AiChatMessage = {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  webEnabled: boolean;
  thinkingEnabled: boolean;
  reasoningContent?: string | null;
  status: 'streaming' | 'completed' | 'failed';
  citations: AiChatCitation[];
  agentEvents?: AiChatAgentEvent[];
  errorMessage?: string | null;
  createTime: string;
};

export type AiChatSession = {
  id: number;
  title: string;
  createTime: string;
  updateTime: string;
  knowledgeBaseIds?: number[];
  messages?: AiChatMessage[];
};

export async function createAiChatSession(): Promise<AiChatSession> {
  return request<AiChatSession>('/ai/chat/sessions', { method: 'POST' });
}

export async function listAiChatSessions(): Promise<AiChatSession[]> {
  return request<AiChatSession[]>('/ai/chat/sessions');
}

export async function getAiChatSession(sessionId: number): Promise<AiChatSession> {
  return request<AiChatSession>(`/ai/chat/sessions/${sessionId}`);
}

export async function deleteAiChatSession(sessionId: number): Promise<void> {
  await request(`/ai/chat/sessions/${sessionId}`, { method: 'DELETE' });
}

export type KnowledgeDocumentStatus =
  | 'uploaded'
  | 'queued'
  | 'parsing'
  | 'normalizing'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'ready'
  | 'failed'
  | 'cancelled';

export type KnowledgeBase = {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  isDefault: boolean;
  documentCount: number;
  readyCount: number;
  createTime: string;
  updateTime: string;
};

export type KnowledgeParseOptions = {
  backend: string;
  effort: 'low' | 'medium' | 'high';
  parse_method: 'auto' | 'txt' | 'ocr';
  lang_list: string[];
  formula_enable: boolean;
  table_enable: boolean;
  image_analysis: boolean;
  start_page_id: number;
  end_page_id: number;
  return_md: boolean;
  return_content_list: boolean;
  return_middle_json: boolean;
  return_model_output: boolean;
  return_images: boolean;
  chunk_size: number;
  chunk_overlap: number;
};

export type KnowledgeDocumentVersion = {
  id: number;
  version: number;
  status: KnowledgeDocumentStatus;
  progress: number;
  queuedAhead?: number | null;
  chunkCount: number;
  errorMessage?: string | null;
  mineruTaskId?: string | null;
  traceId?: string | null;
  failureType?: string | null;
  stageDurationMs?: number | null;
  totalDurationMs?: number | null;
  options?: Partial<KnowledgeParseOptions> | null;
  startedTime?: string | null;
  completedTime?: string | null;
  createTime: string;
  updateTime: string;
};

export type KnowledgeDocument = {
  id: number;
  documentId: string;
  knowledgeBaseId: number;
  knowledgeBaseName: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: KnowledgeDocumentStatus;
  chunkCount: number;
  errorMessage?: string | null;
  version: number;
  progress: number;
  queuedAhead?: number | null;
  graphStatus?: 'none' | 'running' | 'completed' | 'failed' | 'disabled' | 'unavailable' | string | null;
  graphNodeCount?: number | null;
  graphRelationCount?: number | null;
  graphPendingCount?: number | null;
  graphErrorMessage?: string | null;
  graphUpdatedAt?: string | null;
  options?: Partial<KnowledgeParseOptions> | null;
  versions?: KnowledgeDocumentVersion[];
  createTime: string;
  updateTime: string;
};

export type KnowledgeCapabilities = {
  mineru?: { title?: string; version?: string };
  maxFileSize?: number;
  parseOptionsSchema?: {
    properties?: Record<string, { enum?: string[]; default?: unknown }>;
  };
  presets?: Record<string, Partial<KnowledgeParseOptions>>;
};

export async function listKnowledgeDocuments(
  knowledgeBaseId?: number
): Promise<KnowledgeDocument[]> {
  const query = knowledgeBaseId ? `?knowledgeBaseId=${knowledgeBaseId}` : '';
  return request<KnowledgeDocument[]>(`/knowledge/documents${query}`);
}

export async function uploadKnowledgeDocument(
  knowledgeBaseId: number,
  file: File,
  options: KnowledgeParseOptions
): Promise<KnowledgeDocument> {
  const formData = new FormData();
  formData.append('knowledgeBaseId', String(knowledgeBaseId));
  formData.append('file', file);
  formData.append('options', JSON.stringify(options));
  const authToken = localStorage.getItem('authToken');
  const response = await fetch(`${API_BASE_URL}/knowledge/documents`, {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: formData,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.code !== 200) {
    throw new Error(payload?.message || `文档上传失败: ${response.status}`);
  }
  return payload.data as KnowledgeDocument;
}

export async function retryKnowledgeDocument(
  id: number,
  options?: Partial<KnowledgeParseOptions>
): Promise<KnowledgeDocument> {
  return request<KnowledgeDocument>(`/knowledge/documents/${id}/retry`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
}

export async function extractKnowledgeDocumentGraph(id: number): Promise<KnowledgeDocument> {
  return request<KnowledgeDocument>(`/knowledge/documents/${id}/extract-graph`, {
    method: 'POST',
  });
}

export async function deleteKnowledgeDocumentGraph(id: number): Promise<KnowledgeDocument> {
  return request<KnowledgeDocument>(`/knowledge/documents/${id}/delete-graph`, {
    method: 'POST',
  });
}

export async function deleteKnowledgeDocument(id: number): Promise<void> {
  await request(`/knowledge/documents/${id}`, { method: 'DELETE' });
}

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  return request<KnowledgeBase[]>('/knowledge-bases');
}

export async function createKnowledgeBase(data: {
  name: string;
  description?: string;
  color?: string;
}): Promise<KnowledgeBase> {
  return request<KnowledgeBase>('/knowledge-bases', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateKnowledgeBase(
  id: number,
  data: { name: string; description?: string; color?: string }
): Promise<KnowledgeBase> {
  return request<KnowledgeBase>(`/knowledge-bases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteKnowledgeBase(id: number): Promise<void> {
  await request(`/knowledge-bases/${id}`, { method: 'DELETE' });
}

export async function getKnowledgeDocument(id: number): Promise<KnowledgeDocument> {
  return request<KnowledgeDocument>(`/knowledge/documents/${id}`);
}

export async function getKnowledgeCapabilities(): Promise<KnowledgeCapabilities> {
  return request<KnowledgeCapabilities>('/knowledge/documents/capabilities');
}

export async function cancelKnowledgeDocument(id: number): Promise<void> {
  await request(`/knowledge/documents/${id}/cancel`, { method: 'POST' });
}

export async function moveKnowledgeDocument(
  id: number,
  knowledgeBaseId: number
): Promise<KnowledgeDocument> {
  return request<KnowledgeDocument>(`/knowledge/documents/${id}/move`, {
    method: 'PATCH',
    body: JSON.stringify({ knowledgeBaseId }),
  });
}

export async function getKnowledgeArtifact(
  id: number,
  version: number,
  kind: 'markdown' | 'content-list' | 'raw' | 'chunks'
): Promise<string> {
  const authToken = localStorage.getItem('authToken');
  const response = await fetch(
    `${API_BASE_URL}/knowledge/documents/${id}/versions/${version}/artifacts/${kind}`,
    { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} }
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || `读取解析产物失败: ${response.status}`);
  }
  return response.text();
}

export async function downloadKnowledgeOriginal(id: number, fileName: string): Promise<void> {
  const authToken = localStorage.getItem('authToken');
  const response = await fetch(`${API_BASE_URL}/knowledge/documents/${id}/original`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
  if (!response.ok) {
    throw new Error(`下载原文件失败: ${response.status}`);
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function updateAiChatKnowledgeBases(
  sessionId: number,
  knowledgeBaseIds: number[]
): Promise<AiChatSession> {
  return request<AiChatSession>(`/ai/chat/sessions/${sessionId}/knowledge-bases`, {
    method: 'PUT',
    body: JSON.stringify({ knowledgeBaseIds }),
  });
}

type AiChatStreamHandlers = {
  onStatus?: (message: string) => void;
  onWarning?: (message: string) => void;
  onAgentAction?: (event: AiChatAgentEvent) => void;
  onToolResult?: (event: AiChatAgentEvent) => void;
  onMemoryUpdate?: (event: AiChatAgentEvent) => void;
  onToken?: (token: string) => void;
  onReasoning?: (token: string) => void;
  onCitation?: (citations: AiChatCitation[]) => void;
  onDone?: () => void;
};

export async function streamAiChatMessage(
  sessionId: number,
  question: string,
  webEnabled: boolean,
  thinkingEnabled: boolean,
  handlers: AiChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const authToken = localStorage.getItem('authToken');
  const response = await fetch(`${API_BASE_URL}/ai/chat/sessions/${sessionId}/messages/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ question, webEnabled, thinkingEnabled }),
    signal,
  });

  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || `问答请求失败: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = 'message';

  const dispatch = (dataText: string) => {
    const data = JSON.parse(dataText);
    if (eventName === 'status') handlers.onStatus?.(data.message || '');
    if (eventName === 'warning') handlers.onWarning?.(data.message || '');
    if (eventName === 'agent_action') handlers.onAgentAction?.({
      type: 'agent_action',
      title: data.title || 'Agent 动作',
      message: data.message || '',
    });
    if (eventName === 'tool_result') handlers.onToolResult?.({
      type: 'tool_result',
      title: data.title || '工具结果',
      message: data.message || '',
    });
    if (eventName === 'memory_update') handlers.onMemoryUpdate?.({
      type: 'memory_update',
      title: data.title || '记忆更新',
      message: data.message || '',
    });
    if (eventName === 'reasoning') handlers.onReasoning?.(data.content || '');
    if (eventName === 'token') handlers.onToken?.(data.content || '');
    if (eventName === 'citation') handlers.onCitation?.(data.citations || []);
    if (eventName === 'done') handlers.onDone?.();
    if (eventName === 'error') throw new Error(data.message || '问答服务暂时不可用');
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      let dataText = '';
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        if (line.startsWith('data:')) dataText += line.slice(5).trim();
      }
      if (dataText) dispatch(dataText);
      eventName = 'message';
    }
    if (done) break;
  }
}
