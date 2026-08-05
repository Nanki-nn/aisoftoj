import { ExamPaper, ExamSession, Question, QuestionOption } from '../types/exam';
import {
  PageResult,
  PracticeHistorySummary,
  PracticeRecord,
  PracticeSessionRecord,
  WrongQuestionSummary,
} from '../types/record';
import { EmailCodeLoginForm, LoginForm, PasswordResetForm, RegisterForm, User } from '../types/user';
import {
  CONTENT_CRYPTO_ENCRYPTED_HEADER,
  ContentCryptoError,
  decryptContentEnvelope,
  getContentCryptoRequestHeaders,
} from './contentCrypto';

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
  data?: unknown;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: number;
  readonly data?: unknown;

  constructor(message: string, status: number, code?: number, data?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

type PageQuery = {
  page?: number;
  pageSize?: number;
};

type PaperDTO = {
  id: number;
  name?: string;
  subjectName?: string;
  paperCateId: number;
  paperYear?: number;
  paperMonth?: number;
  questionTotal: number;
  readCt?: number;
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
  answerRevision?: number | null;
};

type QuestionRecordUpdateResponse = {
  recordId: number;
  userAnswer: string;
  spendTime?: number | null;
  answerRevision: number;
  mutationId: string;
};

const questionRecordRevisions = new Map<string, number>();
const questionRecordUpdateQueues = new Map<string, Promise<void>>();

type StartSessionRes = {
  practiceSessionId: number;
  paperId: number;
  paperName: string;
  status?: number;
  startTime?: string | number;
  paper?: {
    subjectName?: string;
    paperCateId?: number;
    paperYear?: number;
    paperMonth?: number;
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
    paperYear?: number;
    paperMonth?: number;
  };
  questionList: BackendQuestionDTO[];
};

type AuthUserDTO = User;

export type AuthResponse = {
  token: string;
  user: AuthUserDTO;
};

export type EmailCodeScene = 'REGISTER' | 'PASSWORD_RESET' | 'LOGIN';

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
  const questionRecordId = question.questionRecordId ? String(question.questionRecordId) : undefined;
  if (questionRecordId) {
    questionRecordRevisions.set(questionRecordId, question.answerRevision ?? 0);
  }
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
    questionRecordId,
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

async function executeRequest<T>(
  path: string,
  init?: RequestInit,
  encryptedResponse = false
): Promise<T> {
  const authToken = localStorage.getItem('authToken');
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  if (encryptedResponse) {
    const cryptoHeaders = await getContentCryptoRequestHeaders();
    Object.entries(cryptoHeaders).forEach(([name, value]) => headers.set(name, value));
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  let payload: ApiResult<T> | ApiError | null;
  const rawPayload = await response.json().catch(() => null as unknown);

  if (response.ok && encryptedResponse) {
    const encryptedMarker = response.headers.get(CONTENT_CRYPTO_ENCRYPTED_HEADER);
    if (encryptedMarker === '1') {
      try {
        payload = await decryptContentEnvelope<ApiResult<T>>(rawPayload);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Encrypted question response validation failed', error);
        }
        throw new ApiRequestError(
          error instanceof ContentCryptoError
            ? error.message
            : '题目数据安全校验失败，请刷新后重试',
          response.status
        );
      }
    } else {
      const plainPayload = rawPayload as ApiResult<T> | ApiError | null;
      if (plainPayload && plainPayload.code !== 200) {
        payload = plainPayload;
      } else {
        throw new ApiRequestError('题目数据安全校验失败，请刷新后重试', response.status);
      }
    }
  } else {
    payload = rawPayload as ApiResult<T> | ApiError | null;
  }

  if (!response.ok) {
    const errorPayload = payload as ApiError | null;
    throw new ApiRequestError(
      errorPayload?.message || `请求失败: ${response.status}`,
      response.status,
      errorPayload?.code,
      errorPayload?.data
    );
  }

  const result = payload as ApiResult<T>;
  if (!result || result.code !== 200) {
    const errorPayload = payload as ApiError | null;
    throw new ApiRequestError(
      errorPayload?.message || result?.message || '请求失败',
      response.status,
      errorPayload?.code ?? result?.code
    );
  }
  return result.data;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return executeRequest<T>(path, init, false);
}

export async function requestEncrypted<T>(path: string, init?: RequestInit): Promise<T> {
  return executeRequest<T>(path, init, true);
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

export async function requestEmailCode(email: string, scene: EmailCodeScene): Promise<void> {
  await request<void>('/auth/email/code', {
    method: 'POST',
    body: JSON.stringify({ email, scene }),
  });
}

export async function loginByEmailCode(form: EmailCodeLoginForm): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/email/login', {
    method: 'POST',
    body: JSON.stringify(form),
  });
}

export async function resetPasswordByEmail(form: PasswordResetForm): Promise<void> {
  await request<void>('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify(form),
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
    lastPracticeTime: paper.lastPracticeTime || null,
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
  const data = await requestEncrypted<StartSessionRes>('/session/start', {
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
    paperYear: data.paper?.paperYear,
    paperMonth: data.paper?.paperMonth,
    subject: data.paper?.subjectName || data.paperName,
    category: mapPaperCate(data.paper?.paperCateId || 1),
    questions,
    answers: buildSessionAnswers(sessionId, questions),
    startTime: parseServerDate(data.startTime) || new Date(),
    isCompleted: data.status === 1,
    examMode,
  };
}

export async function fetchPracticeHistory(params: PageQuery = {}): Promise<PageResult<PracticeSessionRecord, PracticeHistorySummary>> {
  return request<PageResult<PracticeSessionRecord, PracticeHistorySummary>>(
    `/session/history${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
    })}`
  );
}

export async function fetchWrongQuestions(params: PageQuery = {}): Promise<PageResult<PracticeRecord, WrongQuestionSummary>> {
  return requestEncrypted<PageResult<PracticeRecord, WrongQuestionSummary>>(
    `/wrong-questions${buildQueryString({
      page: params.page,
      pageSize: params.pageSize,
    })}`
  );
}

export async function continuePracticeSession(sessionId: string): Promise<ExamSession> {
  const data = await requestEncrypted<GetSessionRes>(`/session/${sessionId}`);
  const questions = data.questionList.map(q => mapQuestion(q, data.paper?.paperCateId ?? 1));
  const isCompleted = data.status === 1;
  const resolvedSessionId = String(data.id);
  return {
    id: resolvedSessionId,
    paperId: String(data.paperId),
    paperName: data.paperName,
    paperYear: data.paper?.paperYear,
    paperMonth: data.paper?.paperMonth,
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

export async function pausePracticeSession(sessionId: string): Promise<void> {
  await request(`/session/${sessionId}/pause`, { method: 'PATCH' });
}

export async function updatePracticeQuestionRecord(
  questionRecordId: string,
  userAnswer: string | string[],
  spendTime = 0
): Promise<void> {
  const previousUpdate = questionRecordUpdateQueues.get(questionRecordId) ?? Promise.resolve();
  const mutationId = createMutationId();
  const update = previousUpdate.then(async () => {
    const expectedRevision = questionRecordRevisions.get(questionRecordId) ?? 0;
    try {
      const response = await request<QuestionRecordUpdateResponse>(
        `/practice/session/question/record/${questionRecordId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            userAnswer: Array.isArray(userAnswer)
              ? userAnswer.map(normalizeAnswerValue).join(',')
              : normalizeAnswerValue(userAnswer),
            spendTime,
            expectedRevision,
            mutationId,
          }),
        }
      );
      questionRecordRevisions.set(questionRecordId, response.answerRevision);
    } catch (error) {
      if (isApiRequestError(error) && error.status === 409 && isQuestionRecordUpdateResponse(error.data)) {
        questionRecordRevisions.set(questionRecordId, error.data.answerRevision);
      }
      throw error;
    }
  });

  let trackedUpdate: Promise<void>;
  trackedUpdate = update.finally(() => {
    if (questionRecordUpdateQueues.get(questionRecordId) === trackedUpdate) {
      questionRecordUpdateQueues.delete(questionRecordId);
    }
  });
  questionRecordUpdateQueues.set(questionRecordId, trackedUpdate);
  return trackedUpdate;
}

function createMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isQuestionRecordUpdateResponse(value: unknown): value is QuestionRecordUpdateResponse {
  return Boolean(
    value
      && typeof value === 'object'
      && typeof (value as QuestionRecordUpdateResponse).answerRevision === 'number'
  );
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
  return requestEncrypted<EssayQuestion[]>(path);
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
  return requestEncrypted<EssayHistoryItem[]>('/essay/history', {
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
  lastLoginTime: string | null;
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
  return requestEncrypted<AdminPageDTO<AdminQuestionDTO>>(
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
  return requestEncrypted<AdminQuestionDTO>('/admin/questions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAdminQuestion(
  questionId: number,
  data: AdminQuestionRequest
): Promise<AdminQuestionDTO> {
  return requestEncrypted<AdminQuestionDTO>(`/admin/questions/${questionId}`, {
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
