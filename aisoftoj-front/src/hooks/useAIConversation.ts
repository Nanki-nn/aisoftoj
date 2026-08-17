import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AIApiError,
  AIMessage,
  AIRun,
  AIStreamEvent,
  AIThread,
  cancelAIRun,
  createAIRun,
  createAIThread,
  getAIRun,
  listAIMessages,
  listAIRuns,
  listAIThreads,
  streamAIRun,
} from '../lib/aiApi';

export type ConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'sent' | 'streaming' | 'failed';
  idempotencyKey?: string;
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

function toConversationMessage(message: AIMessage): ConversationMessage {
  return { id: message.id, role: message.role, content: message.content, status: 'sent' };
}

function errorMessage(error: unknown): string {
  if (error instanceof AIApiError) {
    if (error.status === 401 || error.code === 'AUTH_EXPIRED') return '登录状态已失效，请重新登录';
    if (error.status === 429) return 'AI 助手当前繁忙，请稍后重试';
    return error.message;
  }
  return 'AI 服务暂时不可用，请稍后重试';
}

export function useAIConversation(enabled: boolean) {
  const [threads, setThreads] = useState<AIThread[]>([]);
  const [currentThread, setCurrentThread] = useState<AIThread | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRunRef = useRef<AIRun | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadGenerationRef = useRef(0);

  const refreshMessages = useCallback(async (threadId: string) => {
    const page = await listAIMessages(threadId);
    setMessages(page.items.map(toConversationMessage));
  }, []);

  const followRun = useCallback(async (threadId: string, run: AIRun) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    activeRunRef.current = run;
    setIsGenerating(true);
    setError(null);
    let sequence = 0;
    let retries = 0;
    let terminal = false;

    const applyEvent = (event: AIStreamEvent) => {
      if (event.id !== null) {
        if (event.id <= sequence) return;
        sequence = event.id;
      }
      const payload = (event.data.data || {}) as Record<string, unknown>;
      if (event.event === 'message.delta' && typeof payload.delta === 'string') {
        const assistantId = `assistant-${run.id}`;
        setMessages(previous => {
          const existing = previous.find(item => item.id === assistantId);
          if (existing) {
            return previous.map(item => item.id === assistantId
              ? { ...item, content: item.content + payload.delta, status: 'streaming' }
              : item);
          }
          return [...previous, {
            id: assistantId,
            role: 'assistant',
            content: payload.delta as string,
            status: 'streaming',
          }];
        });
      }
      if (event.event === 'run.failed') {
        terminal = true;
        const code = typeof payload.error_code === 'string' ? payload.error_code : undefined;
        setError(code === 'AUTH_EXPIRED'
          ? '登录状态已失效，请重新登录'
          : 'AI 回答生成失败，请重试');
      }
      if (event.event === 'run.cancelled' || event.event === 'run.interrupted') {
        terminal = true;
        setError(event.event === 'run.interrupted' ? 'AI 服务已重启，请重新发送' : null);
      }
      if (event.event === 'run.completed') terminal = true;
      if (event.event === 'stream.end') terminal = true;
      if (event.event === 'stream.reset') {
        const resetSequence = Number(event.data.last_sequence);
        if (Number.isFinite(resetSequence)) sequence = Math.max(sequence, resetSequence);
      }
    };

    try {
      while (!controller.signal.aborted && retries <= 2 && !terminal) {
        try {
          await streamAIRun(threadId, run.id, sequence, controller.signal, applyEvent);
        } catch (streamError) {
          if (controller.signal.aborted) return;
          if (streamError instanceof AIApiError && streamError.status === 401) throw streamError;
        }
        if (terminal) break;
        const current = await getAIRun(threadId, run.id);
        if (TERMINAL_STATUSES.has(current.status)) {
          terminal = true;
          if (current.status !== 'completed') {
            setError(current.error_code === 'AUTH_EXPIRED'
              ? '登录状态已失效，请重新登录'
              : 'AI 回答未能完成，请重试');
          }
          break;
        }
        retries += 1;
      }
      const finalRun = await getAIRun(threadId, run.id);
      if (finalRun.status === 'completed') {
        await refreshMessages(threadId);
      } else if (ACTIVE_STATUSES.has(finalRun.status) && retries > 2) {
        setError('连接已中断，重新打开面板后可继续接收回答');
      }
    } catch (followError) {
      if (!controller.signal.aborted) setError(errorMessage(followError));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (activeRunRef.current?.id === run.id) activeRunRef.current = null;
      setIsGenerating(false);
    }
  }, [refreshMessages]);

  const loadThread = useCallback(async (thread: AIThread) => {
    const generation = ++loadGenerationRef.current;
    abortRef.current?.abort();
    setCurrentThread(thread);
    localStorage.setItem(storageKey(), thread.id);
    setIsLoading(true);
    setError(null);
    try {
      const [messagePage, runPage] = await Promise.all([
        listAIMessages(thread.id),
        listAIRuns(thread.id),
      ]);
      if (generation !== loadGenerationRef.current) return;
      setMessages(messagePage.items.map(toConversationMessage));
      const activeRun = runPage.items.find(item => ACTIVE_STATUSES.has(item.status));
      if (activeRun) void followRun(thread.id, activeRun);
    } catch (loadError) {
      if (generation === loadGenerationRef.current) setError(errorMessage(loadError));
    } finally {
      if (generation === loadGenerationRef.current) setIsLoading(false);
    }
  }, [followRun]);

  const initialize = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await listAIThreads();
      setThreads(page.items);
      const savedId = localStorage.getItem(storageKey());
      const selected = page.items.find(item => item.id === savedId) || page.items[0];
      if (selected) await loadThread(selected);
      else setMessages([]);
    } catch (initializationError) {
      setError(errorMessage(initializationError));
    } finally {
      setIsLoading(false);
    }
  }, [loadThread]);

  useEffect(() => {
    if (enabled) void initialize();
  }, [enabled, initialize]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const submitMessage = useCallback(async (
    content: string,
    idempotencyKey: string,
    existingMessageId?: string,
  ) => {
    if (isGenerating) return;
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
        run = await createAIRun(thread.id, content, idempotencyKey);
      } catch (creationError) {
        if (!(creationError instanceof AIApiError) || creationError.status !== 409) throw creationError;
        const runs = await listAIRuns(thread.id);
        const active = runs.items.find(item => ACTIVE_STATUSES.has(item.status));
        if (!active) throw creationError;
        run = active;
      }
      await followRun(thread.id, run);
      const refreshed = await listAIThreads();
      setThreads(refreshed.items);
    } catch (submissionError) {
      setMessages(previous => previous.map(item => item.id === userMessageId
        ? { ...item, status: 'failed', idempotencyKey }
        : item));
      setError(errorMessage(submissionError));
      setIsGenerating(false);
    }
  }, [currentThread, followRun, isGenerating]);

  const sendMessage = useCallback((content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    void submitMessage(trimmed, crypto.randomUUID());
  }, [submitMessage]);

  const retryMessage = useCallback((messageId: string) => {
    const message = messages.find(item => item.id === messageId);
    if (!message?.idempotencyKey) return;
    void submitMessage(message.content, message.idempotencyKey, message.id);
  }, [messages, submitMessage]);

  const cancelCurrentRun = useCallback(async () => {
    const run = activeRunRef.current;
    if (!run) return;
    try {
      await cancelAIRun(run.thread_id, run.id);
    } catch (cancelError) {
      setError(errorMessage(cancelError));
    }
  }, []);

  const newConversation = useCallback(async () => {
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
    setIsGenerating(false);
    setError(null);
    localStorage.removeItem(storageKey());
  }, []);

  return {
    threads,
    currentThread,
    messages,
    isLoading,
    isGenerating,
    error,
    sendMessage,
    retryMessage,
    cancelCurrentRun,
    newConversation,
    selectThread: loadThread,
  };
}
