import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AIApiError,
  AIRunContext,
  AIRun,
  AIThread,
  cancelAIRun,
  createAIRun,
  createAIThread,
  getAIRun,
  listAIMessages,
  listAIRunEvents,
  listAIRuns,
  listAIThreads,
  getAIQuota,
} from '../lib/aiApi';
import {
  ConversationMessage,
  RunViewState,
  applyEvent,
  applyRunSnapshot,
  createRunViewState,
  normalizeEvent,
  toConversationMessage,
} from '../lib/aiEvents';
import { runAIStreamSession } from '../lib/aiRunSession';

export type { ConversationMessage } from '../lib/aiEvents';

type AIConversationOptions = {
  active: boolean;
  available: boolean;
};

const ACTIVE_STATUSES = new Set(['queued', 'running']);
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'interrupted']);

function storageKey(): string {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}') as { id?: string | number };
    return `aiActiveThread:${user.id || 'unknown'}`;
  } catch {
    return 'aiActiveThread:unknown';
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof AIApiError) {
    if (error.status === 401 || error.code === 'AUTH_EXPIRED') return '登录状态已失效，请重新登录';
    if (error.code === 'AI_DAILY_TOKEN_QUOTA_EXCEEDED') return '今日 AI 助手额度已用完';
    if (error.status === 429) return 'AI 助手当前繁忙，请稍后重试';
    return error.message;
  }
  return 'AI 服务暂时不可用，请稍后重试';
}

async function replayRunEvents(
  threadId: string,
  run: AIRun,
): Promise<{ state: RunViewState; transportSequence: number }> {
  let state = createRunViewState(run.id);
  let transportSequence = 0;
  let hasMore = true;
  while (hasMore) {
    const page = await listAIRunEvents(threadId, run.id, transportSequence);
    page.items.forEach(raw => {
      transportSequence = Math.max(transportSequence, raw.sequence);
      const normalized = normalizeEvent(raw);
      if (normalized?.event) state = applyEvent(state, normalized.event);
    });
    hasMore = page.has_more;
    if (hasMore && page.next_after_sequence !== null) {
      transportSequence = Math.max(transportSequence, page.next_after_sequence);
    } else if (hasMore && page.items.length === 0) {
      break;
    }
  }
  return { state: applyRunSnapshot(state, run), transportSequence };
}

export function useAIConversation({ active, available }: AIConversationOptions) {
  const [threads, setThreads] = useState<AIThread[]>([]);
  const [currentThread, setCurrentThread] = useState<AIThread | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [runStates, setRunStates] = useState<Record<string, RunViewState>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaResetAt, setQuotaResetAt] = useState<string | null>(null);
  const activeRunRef = useRef<AIRun | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadGenerationRef = useRef(0);

  const recordQuotaState = useCallback((remaining: number, resetAt: string) => {
    setQuotaResetAt(remaining <= 0 ? resetAt : null);
  }, []);

  const refreshQuota = useCallback(async (forceExhausted = false) => {
    if (!available) return;
    const quota = await getAIQuota();
    if (forceExhausted) {
      setQuotaResetAt(quota.reset_at);
    } else {
      recordQuotaState(quota.remaining, quota.reset_at);
    }
  }, [available, recordQuotaState]);

  useEffect(() => {
    if (!quotaResetAt) return;
    const delay = new Date(quotaResetAt).getTime() - Date.now();
    if (delay <= 0) {
      setQuotaResetAt(null);
      return;
    }
    const timer = window.setTimeout(
      () => setQuotaResetAt(null),
      Math.min(delay, 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [quotaResetAt]);

  const refreshMessages = useCallback(async (threadId: string) => {
    if (!available) return;
    const page = await listAIMessages(threadId);
    setMessages(page.items.map(toConversationMessage));
  }, [available]);

  const followRun = useCallback(async (
    threadId: string,
    run: AIRun,
    initialSequence = 0,
  ) => {
    if (!available) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    activeRunRef.current = run;
    setIsGenerating(true);
    setError(null);
    setRunStates(previous => ({
      ...previous,
      [run.id]: applyRunSnapshot(previous[run.id] || createRunViewState(run.id), run),
    }));

    try {
      const result = await runAIStreamSession(
        threadId,
        run,
        initialSequence,
        controller.signal,
        event => setRunStates(previous => ({
          ...previous,
          [run.id]: applyEvent(previous[run.id] || createRunViewState(run.id), event),
        })),
      );
      setRunStates(previous => ({
        ...previous,
        [run.id]: applyRunSnapshot(previous[run.id] || createRunViewState(run.id), result.run),
      }));
      setError(ACTIVE_STATUSES.has(result.run.status)
        ? '连接已中断，重新打开面板后可继续接收回答'
        : null);
      if (result.run.status === 'completed') await refreshMessages(threadId);
      if (result.run.error_code === 'AI_DAILY_TOKEN_QUOTA_EXCEEDED') {
        await refreshQuota(true).catch(() => undefined);
      } else if (TERMINAL_STATUSES.has(result.run.status)) {
        await refreshQuota().catch(() => undefined);
      }
    } catch (followError) {
      if (!controller.signal.aborted) setError(errorMessage(followError));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (activeRunRef.current?.id === run.id) activeRunRef.current = null;
      setIsGenerating(false);
    }
  }, [available, refreshMessages, refreshQuota]);

  const loadThread = useCallback(async (thread: AIThread) => {
    if (!available) return;
    const generation = ++loadGenerationRef.current;
    abortRef.current?.abort();
    setCurrentThread(thread);
    localStorage.setItem(storageKey(), thread.id);
    setIsLoading(true);
    setError(null);
    try {
      const [messagePage, runPage] = await Promise.all([
        listAIMessages(thread.id),
        listAIRuns(thread.id, 1, 100),
      ]);
      if (generation !== loadGenerationRef.current) return;
      const nextMessages = messagePage.items.map(toConversationMessage);
      setMessages(nextMessages);

      const visibleRunIds = Array.from(new Set(
        nextMessages.map(message => message.runId).filter((runId): runId is string => Boolean(runId)),
      ));
      const runMap = new Map(runPage.items.map(run => [run.id, run]));
      const missingRuns = await Promise.all(
        visibleRunIds.filter(runId => !runMap.has(runId)).map(runId => getAIRun(thread.id, runId)),
      );
      missingRuns.forEach(run => runMap.set(run.id, run));
      const visibleRuns = visibleRunIds.map(runId => runMap.get(runId)).filter((run): run is AIRun => Boolean(run));
      const histories = await Promise.allSettled(
        visibleRuns.map(run => replayRunEvents(thread.id, run)),
      );
      if (generation !== loadGenerationRef.current) return;

      const nextRunStates: Record<string, RunViewState> = {};
      const transportSequences = new Map<string, number>();
      histories.forEach((history, index) => {
        const run = visibleRuns[index];
        if (history.status === 'fulfilled') {
          nextRunStates[run.id] = history.value.state;
          transportSequences.set(run.id, history.value.transportSequence);
        } else {
          nextRunStates[run.id] = applyRunSnapshot(createRunViewState(run.id), run);
        }
      });
      setRunStates(nextRunStates);
      if (histories.some(history => history.status === 'rejected')) {
        setError('部分历史执行过程暂时无法加载，最终回答仍可查看');
      }

      const activeRun = Array.from(runMap.values()).find(item => ACTIVE_STATUSES.has(item.status));
      if (activeRun) {
        void followRun(thread.id, activeRun, transportSequences.get(activeRun.id) || 0);
      }
    } catch (loadError) {
      if (generation === loadGenerationRef.current) setError(errorMessage(loadError));
    } finally {
      if (generation === loadGenerationRef.current) setIsLoading(false);
    }
  }, [available, followRun]);

  const initialize = useCallback(async () => {
    if (!available) return;
    setIsLoading(true);
    setError(null);
    try {
      const [page] = await Promise.all([
        listAIThreads(),
        refreshQuota().catch(() => undefined),
      ]);
      setThreads(page.items);
      const savedId = localStorage.getItem(storageKey());
      const selected = page.items.find(item => item.id === savedId) || page.items[0];
      if (selected) await loadThread(selected);
      else {
        setMessages([]);
        setRunStates({});
      }
    } catch (initializationError) {
      setError(errorMessage(initializationError));
    } finally {
      setIsLoading(false);
    }
  }, [available, loadThread, refreshQuota]);

  useEffect(() => {
    if (active && available) void initialize();
  }, [active, available, initialize]);

  useEffect(() => {
    if (active && available) return;
    abortRef.current?.abort();
    abortRef.current = null;
    activeRunRef.current = null;
    loadGenerationRef.current += 1;
    setIsLoading(false);
    setIsGenerating(false);
    if (!available) {
      setThreads([]);
      setCurrentThread(null);
      setMessages([]);
      setRunStates({});
      setError(null);
      setQuotaResetAt(null);
    }
  }, [active, available]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const submitMessage = useCallback(async (
    content: string,
    idempotencyKey: string,
    existingMessageId?: string,
    context?: AIRunContext,
  ) => {
    if (!available || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    let thread = currentThread;
    const userMessageId = existingMessageId || `pending-${idempotencyKey}`;
    if (existingMessageId) {
      setMessages(previous => previous.map(item => item.id === existingMessageId
        ? { ...item, status: 'sent' }
        : item));
    } else {
      setMessages(previous => [...previous, {
        id: userMessageId,
        role: 'user',
        content,
        status: 'sent',
        idempotencyKey,
        context,
      }]);
    }
    try {
      if (!thread) {
        thread = await createAIThread(content.slice(0, 120));
        setCurrentThread(thread);
        setThreads(previous => [thread as AIThread, ...previous]);
        localStorage.setItem(storageKey(), thread.id);
      }
      let run: AIRun;
      try {
        run = await createAIRun(thread.id, content, idempotencyKey, context);
      } catch (creationError) {
        if (!(creationError instanceof AIApiError) || creationError.status !== 409) throw creationError;
        const runs = await listAIRuns(thread.id);
        const active = runs.items.find(item => ACTIVE_STATUSES.has(item.status));
        if (!active) throw creationError;
        run = active;
      }
      setMessages(previous => previous.map(item => item.id === userMessageId
        ? { ...item, runId: run.id }
        : item));
      setRunStates(previous => ({
        ...previous,
        [run.id]: applyRunSnapshot(createRunViewState(run.id), run),
      }));
      await followRun(thread.id, run);
      const refreshed = await listAIThreads();
      setThreads(refreshed.items);
    } catch (submissionError) {
      setMessages(previous => previous.map(item => item.id === userMessageId
        ? { ...item, status: 'failed', idempotencyKey }
        : item));
      setError(errorMessage(submissionError));
      if (
        submissionError instanceof AIApiError
        && submissionError.code === 'AI_DAILY_TOKEN_QUOTA_EXCEEDED'
      ) {
        const resetAt = submissionError.details?.reset_at;
        if (typeof resetAt === 'string') {
          setQuotaResetAt(resetAt);
          setError(null);
        }
      }
      setIsGenerating(false);
    }
  }, [available, currentThread, followRun, isGenerating]);

  const sendMessage = useCallback((content: string, context?: AIRunContext) => {
    if (!available) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    void submitMessage(trimmed, crypto.randomUUID(), undefined, context);
  }, [available, submitMessage]);

  const retryMessage = useCallback((messageId: string) => {
    if (!available) return;
    const message = messages.find(item => item.id === messageId);
    if (!message?.idempotencyKey) return;
    void submitMessage(message.content, message.idempotencyKey, message.id, message.context);
  }, [available, messages, submitMessage]);

  const cancelCurrentRun = useCallback(async () => {
    if (!available) return;
    const run = activeRunRef.current;
    if (!run) return;
    try {
      await cancelAIRun(run.thread_id, run.id);
    } catch (cancelError) {
      setError(errorMessage(cancelError));
    }
  }, [available]);

  const newConversation = useCallback(async () => {
    if (!available) return;
    const run = activeRunRef.current;
    if (run) {
      try {
        await cancelAIRun(run.thread_id, run.id);
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const current = await getAIRun(run.thread_id, run.id);
          if (TERMINAL_STATUSES.has(current.status)) break;
          await new Promise(resolve => window.setTimeout(resolve, 250));
        }
      } catch (cancelError) {
        setError(errorMessage(cancelError));
        return;
      }
    }
    abortRef.current?.abort();
    loadGenerationRef.current += 1;
    activeRunRef.current = null;
    setCurrentThread(null);
    setMessages([]);
    setRunStates({});
    setIsGenerating(false);
    setError(null);
    localStorage.removeItem(storageKey());
  }, [available]);

  return {
    threads,
    currentThread,
    messages,
    runStates,
    isLoading,
    isGenerating,
    error,
    quotaExhausted: quotaResetAt !== null,
    quotaResetAt,
    sendMessage,
    retryMessage,
    cancelCurrentRun,
    newConversation,
    selectThread: loadThread,
  };
}
