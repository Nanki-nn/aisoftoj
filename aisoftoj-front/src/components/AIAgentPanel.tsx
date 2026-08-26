import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpenCheck,
  Brain,
  CalendarCheck2,
  ChevronDown,
  FileSearch,
  History,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { useAgentPanel } from '../hooks/useAgentPanel';
import { useAIConversation } from '../hooks/useAIConversation';
import {
  AI_ASSISTANT_ENABLED,
  AI_ASSISTANT_UNAVAILABLE_MESSAGE,
} from '../lib/aiAvailability';
import { getMessageGroups } from '../lib/aiMessageGroups';
import { AIMessageList } from './AIMessageList';

const QUICK_PROMPTS = [
  {
    icon: CalendarCheck2,
    title: '今天学什么',
    prompt: '结合我的学习进度，安排今天的备考任务',
  },
  {
    icon: Brain,
    title: '知识点梳理',
    prompt: '帮我梳理系统架构设计师的核心知识点',
  },
  {
    icon: FileSearch,
    title: '真题解析',
    prompt: '讲解一道真题的考点和解题思路',
  },
  {
    icon: BookOpenCheck,
    title: '错题分析',
    prompt: '分析我的高频错题和薄弱知识点',
  },
] as const;

const DEFAULT_PANEL_WIDTH = 400;
const MAX_PANEL_WIDTH = 720;
const MIN_VISIBLE_PAGE_WIDTH = 320;
const PANEL_WIDTH_STEP = 24;
const DESKTOP_MEDIA_QUERY = '(min-width: 1280px)';

type ResizeSession = {
  pointerId: number;
  startX: number;
  startWidth: number;
  target: HTMLDivElement;
  previousCursor: string;
  previousUserSelect: string;
};

function getMaxPanelWidth(viewportWidth: number) {
  return Math.max(
    DEFAULT_PANEL_WIDTH,
    Math.min(MAX_PANEL_WIDTH, viewportWidth - MIN_VISIBLE_PAGE_WIDTH),
  );
}

function clampPanelWidth(width: number, viewportWidth: number) {
  return Math.round(
    Math.min(
      getMaxPanelWidth(viewportWidth),
      Math.max(DEFAULT_PANEL_WIDTH, width),
    ),
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export function AIAgentPanel() {
  const { isOpen, close, currentQuestionId } = useAgentPanel();
  const {
    threads,
    currentThread,
    messages,
    runStates,
    isLoading,
    isGenerating,
    error,
    sendMessage,
    retryMessage,
    cancelCurrentRun,
    newConversation,
    selectThread,
  } = useAIConversation({ active: isOpen, available: AI_ASSISTANT_ENABLED });
  const [input, setInput] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(DESKTOP_MEDIA_QUERY).matches
  ));
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [maxPanelWidth, setMaxPanelWidth] = useState(() => (
    typeof window === 'undefined' ? MAX_PANEL_WIDTH : getMaxPanelWidth(window.innerWidth)
  ));
  const [isResizing, setIsResizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);

  const finishResize = useCallback((pointerId?: number) => {
    const session = resizeSessionRef.current;
    if (!session || (pointerId !== undefined && session.pointerId !== pointerId)) return;

    resizeSessionRef.current = null;
    if (session.target.hasPointerCapture(session.pointerId)) {
      session.target.releasePointerCapture(session.pointerId);
    }
    document.body.style.cursor = session.previousCursor;
    document.body.style.userSelect = session.previousUserSelect;
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isOpen && AI_ASSISTANT_ENABLED) {
      window.setTimeout(() => inputRef.current?.focus(), 220);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [close, isOpen]);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [isGenerating, messages]);

  useEffect(() => {
    const desktopQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const updateResponsiveWidth = () => {
      const desktop = desktopQuery.matches;
      const nextMaxWidth = getMaxPanelWidth(window.innerWidth);

      setIsDesktop(desktop);
      setMaxPanelWidth(nextMaxWidth);
      if (desktop) {
        setPanelWidth(width => clampPanelWidth(width, window.innerWidth));
      }
    };

    updateResponsiveWidth();
    desktopQuery.addEventListener('change', updateResponsiveWidth);
    window.addEventListener('resize', updateResponsiveWidth);

    return () => {
      desktopQuery.removeEventListener('change', updateResponsiveWidth);
      window.removeEventListener('resize', updateResponsiveWidth);
    };
  }, []);

  useEffect(() => {
    if (!isDesktop || !isOpen) finishResize();
  }, [finishResize, isDesktop, isOpen]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const session = resizeSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;

      const nextWidth = session.startWidth + session.startX - event.clientX;
      setPanelWidth(clampPanelWidth(nextWidth, window.innerWidth));
    };
    const handlePointerEnd = (event: PointerEvent) => finishResize(event.pointerId);
    const handleWindowBlur = () => finishResize();

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('blur', handleWindowBlur);

      const session = resizeSessionRef.current;
      if (!session) return;
      document.body.style.cursor = session.previousCursor;
      document.body.style.userSelect = session.previousUserSelect;
    };
  }, [finishResize]);

  const resetConversation = () => {
    if (!AI_ASSISTANT_ENABLED) return;
    void newConversation();
    setInput('');
    setHistoryOpen(false);
    inputRef.current?.focus();
  };

  const handleSendMessage = (text: string) => {
    if (!AI_ASSISTANT_ENABLED) return;
    const content = text.trim();
    if (!content || isGenerating) return;

    setInput('');
    sendMessage(content, currentQuestionId ? { questionId: currentQuestionId } : undefined);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!AI_ASSISTANT_ENABLED) return;
    handleSendMessage(input);
  };

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      !isDesktop
      || !event.isPrimary
      || resizeSessionRef.current
      || (event.pointerType === 'mouse' && event.button !== 0)
    ) return;

    event.preventDefault();
    resizeSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: panelWidth,
      target: event.currentTarget,
      previousCursor: document.body.style.cursor,
      previousUserSelect: document.body.style.userSelect,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    setIsResizing(true);
  };

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    event.preventDefault();
    const direction = event.key === 'ArrowLeft' ? 1 : -1;
    setPanelWidth(width => clampPanelWidth(
      width + direction * PANEL_WIDTH_STEP,
      window.innerWidth,
    ));
  };

  return (
    <>
      <button
        type="button"
        aria-label="关闭 AI 助手"
        className={`fixed inset-0 z-[55] bg-slate-950/25 transition-opacity duration-200 xl:hidden ${
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={close}
      />

      <aside
        id="ai-agent-panel"
        aria-label="AI 备考助手"
        aria-hidden={!isOpen}
        inert={isOpen ? undefined : true}
        className={`fixed inset-y-0 right-0 z-[60] flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out sm:w-[400px] xl:shadow-lg ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={isDesktop ? { width: panelWidth } : undefined}
      >
        <div
          role="separator"
          aria-label="调整 AI 助手宽度"
          aria-orientation="vertical"
          aria-valuemin={DEFAULT_PANEL_WIDTH}
          aria-valuemax={maxPanelWidth}
          aria-valuenow={panelWidth}
          tabIndex={isOpen ? 0 : -1}
          className="group absolute inset-y-0 z-20 hidden cursor-col-resize outline-none xl:block"
          style={{ left: -5, width: 10, touchAction: 'none' }}
          onPointerDown={handleResizeStart}
          onLostPointerCapture={event => finishResize(event.pointerId)}
          onKeyDown={handleResizeKeyDown}
        >
          <span
            className={`pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors group-hover:bg-blue-500 group-focus-visible:bg-blue-600 ${
              isResizing ? 'bg-blue-600' : 'bg-transparent'
            }`}
          />
        </div>

        <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4">
          <button
            type="button"
            disabled={!AI_ASSISTANT_ENABLED}
            onClick={() => setHistoryOpen(value => !value)}
            className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:bg-transparent"
            aria-label="打开对话列表"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
            <span className="truncate text-sm font-semibold">
              {currentThread?.title || (AI_ASSISTANT_ENABLED ? '新对话' : 'AI 助手')}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!AI_ASSISTANT_ENABLED}
              onClick={resetConversation}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
              title="新对话"
              aria-label="新对话"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={!AI_ASSISTANT_ENABLED}
              onClick={() => setHistoryOpen(value => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
              title="对话记录"
              aria-label="对话记录"
            >
              <History className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={close}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-600"
              title="关闭"
              aria-label="关闭 AI 助手"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {AI_ASSISTANT_ENABLED && historyOpen && (
            <div className="absolute left-3 right-3 top-[58px] z-10 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl">
              {threads.length === 0 ? (
                <p className="px-3 py-5 text-center text-xs text-slate-500">暂无历史对话</p>
              ) : threads.map(thread => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => {
                    void selectThread(thread);
                    setHistoryOpen(false);
                  }}
                  className={`block w-full truncate rounded-md px-3 py-2 text-left text-sm ${
                    currentThread?.id === thread.id
                      ? 'bg-blue-50 font-medium text-blue-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {thread.title || '未命名对话'}
                </button>
              ))}
            </div>
          )}
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
          {!AI_ASSISTANT_ENABLED ? (
            <div className="flex min-h-full items-center justify-center px-6 py-12 text-center">
              <div role="status" className="max-w-xs rounded-2xl border border-blue-100 bg-blue-50/70 px-6 py-7 text-blue-950">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                  <Sparkles className="h-6 w-6" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-base font-semibold">AI 助手功能准备中</h2>
                <p className="mt-2 text-sm leading-6 text-blue-800">
                  {AI_ASSISTANT_UNAVAILABLE_MESSAGE}
                </p>
              </div>
            </div>
          ) : isLoading && messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" aria-label="正在加载对话" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex min-h-full flex-col px-5 pb-8 pt-10">
              <div className="flex flex-1 flex-col items-center justify-center pb-8 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                  <Sparkles className="h-8 w-8" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">{greeting()}！</h2>
                <p className="mt-1 text-sm text-slate-500">今天想备考哪个方向？</p>
              </div>

              <div className="space-y-2.5">
                {QUICK_PROMPTS.map(({ icon: Icon, title, prompt }) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="group flex min-h-[68px] w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-left outline-none transition-colors hover:border-blue-200 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-600 shadow-sm group-hover:border-blue-200">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800">{title}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{prompt}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <AIMessageList
                groups={getMessageGroups(messages, runStates)}
                onRetry={retryMessage}
              />

              {isGenerating && !Object.values(runStates).some(run => run.tools.length > 0 || run.answer) && (
                <div className="flex items-center gap-2.5 px-4 pb-5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="flex h-10 items-center gap-1 rounded-2xl rounded-tl-md bg-slate-100 px-4" aria-label="AI 正在思考">
                    {[0, 1, 2].map(index => (
                      <span
                        key={index}
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400"
                        style={{ animationDelay: `${index * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white p-3.5">
          {AI_ASSISTANT_ENABLED && error && (
            <div role="alert" className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          <form
            onSubmit={handleSubmit}
            className={`rounded-xl border p-2 shadow-sm ${
              AI_ASSISTANT_ENABLED
                ? 'border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <textarea
              ref={inputRef}
              disabled={!AI_ASSISTANT_ENABLED}
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (!AI_ASSISTANT_ENABLED) return;
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSendMessage(input);
                }
              }}
              placeholder={AI_ASSISTANT_ENABLED
                ? '问我任何软考备考问题...'
                : AI_ASSISTANT_UNAVAILABLE_MESSAGE}
              rows={2}
              className="max-h-32 min-h-12 w-full resize-none border-0 bg-transparent px-2 py-1 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
            />
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-[11px] text-slate-400">
                {AI_ASSISTANT_ENABLED ? 'Enter 发送，Shift + Enter 换行' : '线上请求暂未开放'}
              </span>
              {isGenerating ? (
                <button
                  type="button"
                  disabled={!AI_ASSISTANT_ENABLED}
                  onClick={() => void cancelCurrentRun()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white outline-none hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  aria-label="停止生成"
                  title="停止生成"
                >
                  <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!AI_ASSISTANT_ENABLED || !input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white outline-none transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  aria-label="发送消息"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </form>
          <p className="mt-2 text-center text-[11px] text-slate-400">AI 回答仅供参考，请以官方教材和考试大纲为准</p>
        </footer>
      </aside>
    </>
  );
}
