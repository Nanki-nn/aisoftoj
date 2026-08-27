import {
  AI_ASSISTANT_ENABLED,
  AI_ASSISTANT_UNAVAILABLE_MESSAGE,
} from './aiAvailability';

const AI_API_BASE_URL = import.meta.env.VITE_AI_API_BASE_URL || '';

export type AIThread = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type AISkill = {
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  license: string | null;
};

export type AISkillListResponse = {
  items: AISkill[];
  total: number;
};

export type AIMessage = {
  id: string;
  thread_id: string;
  run_id: string;
  role: 'user' | 'assistant';
  content: string;
  sequence: number;
  created_at: string;
};

export type AIRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export type AIRun = {
  id: string;
  thread_id: string;
  status: AIRunStatus;
  input_message_id: string;
  output_message_id: string | null;
  error_code: string | null;
  model_name: string;
  created_at: string;
  updated_at: string;
};

export type AIRunContext = {
  questionId: number;
};

export function buildRunRequestBody(message: string, context?: AIRunContext) {
  return {
    message,
    ...(context ? { context: { question_id: context.questionId } } : {}),
  };
}

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type MessagePage = {
  items: AIMessage[];
  next_before_sequence: number | null;
  has_more: boolean;
};

export type AIStreamEvent = {
  event: string;
  id: number | null;
  data: Record<string, unknown>;
};

export type AIRunEvent = {
  run_id: string;
  sequence: number;
  type: string;
  created_at: string;
  data: Record<string, unknown>;
};

export type AIEventPage = {
  items: AIRunEvent[];
  next_after_sequence: number | null;
  has_more: boolean;
};

type ErrorEnvelope = {
  error?: { code?: string; message?: string; request_id?: string };
};

export class AIApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AIApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function assertAIAssistantAvailable(): void {
  if (!AI_ASSISTANT_ENABLED) {
    throw new AIApiError(
      AI_ASSISTANT_UNAVAILABLE_MESSAGE,
      503,
      'FEATURE_NOT_AVAILABLE',
    );
  }
}

function authHeaders(extra?: HeadersInit): Headers {
  const token = localStorage.getItem('authToken');
  if (!token) {
    throw new AIApiError('请先登录后使用 AI 助手', 401, 'UNAUTHORIZED');
  }
  const headers = new Headers(extra);
  headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

async function aiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  assertAIAssistantAvailable();
  const headers = authHeaders(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${AI_API_BASE_URL}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => null) as T | ErrorEnvelope | null;
  if (!response.ok) {
    const error = (payload as ErrorEnvelope | null)?.error;
    throw new AIApiError(
      error?.message || `AI 服务请求失败 (${response.status})`,
      response.status,
      error?.code,
      error as Record<string, unknown> | undefined,
    );
  }
  return payload as T;
}

async function aiAdminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = authHeaders(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${AI_API_BASE_URL}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => null) as T | ErrorEnvelope | null;
  if (!response.ok) {
    const error = (payload as ErrorEnvelope | null)?.error;
    throw new AIApiError(
      error?.message || `AI 服务请求失败 (${response.status})`,
      response.status,
      error?.code,
      error as Record<string, unknown> | undefined,
    );
  }
  return payload as T;
}

export type AIQuota = {
  limit: number;
  consumed: number;
  reserved: number;
  remaining: number;
  reset_at: string;
};

export type AICapability = {
  ai_enabled: boolean;
  reason: string | null;
};

export function fetchAICapability(): Promise<AICapability> {
  return aiAdminRequest<AICapability>('/api/ai/capability');
}

export type AIQuotaConfig = {
  daily_token_limit: number;
  updated_by_user_id: number | null;
  updated_at: string | null;
};

export type AdminAIQuotaUsage = {
  user_id: number;
  login_name: string | null;
  nick_name: string | null;
  email: string | null;
  usage_date: string;
  limit: number;
  consumed: number;
  reserved: number;
  remaining: number;
  limit_source: 'global' | 'user';
};

export type AdminAIQuotaUsagePage = {
  records: AdminAIQuotaUsage[];
  total: number;
  page: number;
  page_size: number;
  usage_date: string;
};

export type AdminAIUserQuota = {
  user_id: number;
  limit: number;
  consumed: number;
  reserved: number;
  remaining: number;
  reset_at: string;
  limit_source: 'global' | 'user';
};

export function getAIQuota(): Promise<AIQuota> {
  return aiRequest('/api/ai/quota');
}

export function getAIQuotaConfig(): Promise<AIQuotaConfig> {
  return aiAdminRequest('/api/ai/admin/quota-config');
}

export function updateAIQuotaConfig(dailyTokenLimit: number): Promise<AIQuotaConfig> {
  return aiAdminRequest('/api/ai/admin/quota-config', {
    method: 'PATCH',
    body: JSON.stringify({ daily_token_limit: dailyTokenLimit }),
  });
}

export function listAdminAIQuotaUsage(params: {
  date: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminAIQuotaUsagePage> {
  const query = new URLSearchParams({
    date: params.date,
    page: String(params.page ?? 1),
    page_size: String(params.pageSize ?? 10),
  });
  if (params.keyword) query.set('keyword', params.keyword);
  return aiAdminRequest(`/api/ai/admin/quota-usage?${query.toString()}`);
}

export function updateAdminAIUserQuota(
  userId: number,
  dailyTokenLimit: number,
): Promise<AdminAIUserQuota> {
  return aiAdminRequest(`/api/ai/admin/quota-users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ daily_token_limit: dailyTokenLimit }),
  });
}

export function restoreAdminAIUserQuota(userId: number): Promise<AdminAIUserQuota> {
  return aiAdminRequest(`/api/ai/admin/quota-users/${userId}`, {
    method: 'DELETE',
  });
}

export function createAIThread(title?: string): Promise<AIThread> {
  return aiRequest('/api/ai/threads', {
    method: 'POST',
    body: JSON.stringify({ title: title || null }),
  });
}

export function listAIThreads(page = 1, pageSize = 50): Promise<Page<AIThread>> {
  return aiRequest(`/api/ai/threads?page=${page}&page_size=${pageSize}`);
}

export function listAISkills(): Promise<AISkillListResponse> {
  return aiRequest('/api/ai/skills');
}

export function listAIMessages(threadId: string, limit = 100): Promise<MessagePage> {
  return aiRequest(`/api/ai/threads/${encodeURIComponent(threadId)}/messages?limit=${limit}`);
}

export function createAIRun(
  threadId: string,
  message: string,
  idempotencyKey: string,
  context?: AIRunContext,
): Promise<AIRun> {
  return aiRequest(`/api/ai/threads/${encodeURIComponent(threadId)}/runs`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(buildRunRequestBody(message, context)),
  });
}

export function listAIRuns(threadId: string, page = 1, pageSize = 20): Promise<Page<AIRun>> {
  return aiRequest(
    `/api/ai/threads/${encodeURIComponent(threadId)}/runs?page=${page}&page_size=${pageSize}`,
  );
}

export function getAIRun(threadId: string, runId: string): Promise<AIRun> {
  return aiRequest(
    `/api/ai/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}`,
  );
}

export function listAIRunEvents(
  threadId: string,
  runId: string,
  afterSequence = 0,
  limit = 200,
): Promise<AIEventPage> {
  return aiRequest(
    `/api/ai/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}`
      + `/events?after_sequence=${afterSequence}&limit=${limit}`,
  );
}

export function cancelAIRun(threadId: string, runId: string): Promise<AIRun> {
  return aiRequest(
    `/api/ai/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}/cancel`,
    { method: 'POST' },
  );
}

export async function streamAIRun(
  threadId: string,
  runId: string,
  afterSequence: number,
  signal: AbortSignal,
  onEvent: (event: AIStreamEvent) => void,
): Promise<void> {
  assertAIAssistantAvailable();
  const headers = authHeaders({ Accept: 'text/event-stream' });
  if (afterSequence > 0) {
    headers.set('Last-Event-ID', String(afterSequence));
  }
  const response = await fetch(
    `${AI_API_BASE_URL}/api/ai/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}/stream`,
    { headers, signal },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ErrorEnvelope | null;
    throw new AIApiError(
      payload?.error?.message || `AI 流连接失败 (${response.status})`,
      response.status,
      payload?.error?.code,
    );
  }
  if (!response.body) {
    throw new AIApiError('浏览器不支持流式响应', 500, 'STREAM_UNAVAILABLE');
  }
  await parseSSEStream(response.body, onEvent);
}

export async function parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: AIStreamEvent) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() || '';
      frames.forEach(frame => emitFrame(frame, onEvent));
      if (done) break;
    }
    if (buffer.trim()) emitFrame(buffer, onEvent);
  } finally {
    reader.releaseLock();
  }
}

function emitFrame(frame: string, onEvent: (event: AIStreamEvent) => void): void {
  if (!frame.trim() || frame.trimStart().startsWith(':')) return;
  let event = 'message';
  let id: number | null = null;
  const data: string[] = [];
  frame.split(/\r?\n/).forEach(line => {
    const separator = line.indexOf(':');
    const field = separator >= 0 ? line.slice(0, separator) : line;
    const value = separator >= 0 ? line.slice(separator + 1).replace(/^ /, '') : '';
    if (field === 'event') event = value;
    if (field === 'id' && /^\d+$/.test(value)) id = Number(value);
    if (field === 'data') data.push(value);
  });
  if (!data.length) return;
  const parsed = JSON.parse(data.join('\n')) as Record<string, unknown>;
  onEvent({ event, id, data: parsed });
}
