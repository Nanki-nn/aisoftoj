import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpenCheck,
  Brain,
  CalendarCheck2,
  ChevronDown,
  FileSearch,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgentPanel } from '../hooks/useAgentPanel';
import { useAIConversation } from '../hooks/useAIConversation';

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

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export function AIAgentPanel() {
  const { isOpen, close } = useAgentPanel();
  const {
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
    selectThread,
  } = useAIConversation(isOpen);
  const [input, setInput] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
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

  const resetConversation = () => {
    void newConversation();
    setInput('');
    setHistoryOpen(false);
    inputRef.current?.focus();
  };

  const handleSendMessage = (text: string) => {
    const content = text.trim();
    if (!content || isGenerating) return;

    setInput('');
    sendMessage(content);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    handleSendMessage(input);
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
        inert={!isOpen}
        className={`fixed inset-y-0 right-0 z-[60] flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out sm:w-[400px] xl:shadow-lg ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4">
          <button
            type="button"
            onClick={() => setHistoryOpen(value => !value)}
            className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label="打开对话列表"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
            <span className="truncate text-sm font-semibold">{currentThread?.title || '新对话'}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={resetConversation}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-600"
              title="新对话"
              aria-label="新对话"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setHistoryOpen(value => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-600"
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

          {historyOpen && (
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
          {isLoading && messages.length === 0 ? (
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
            <div className="space-y-5 px-4 py-5">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                    </span>
                  )}
                  <div
                    className={`max-w-[82%] whitespace-pre-wrap px-3.5 py-2.5 text-sm leading-6 ${
                      message.role === 'user'
                        ? 'rounded-2xl rounded-tr-md bg-blue-600 text-white'
                        : 'rounded-2xl rounded-tl-md bg-slate-100 text-slate-800'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none text-slate-800 prose-p:my-1 prose-table:my-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                      </div>
                    ) : message.content}
                    {message.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => retryMessage(message.id)}
                        className="mt-2 flex items-center gap-1 text-xs font-medium text-red-100 underline underline-offset-2"
                      >
                        <RotateCcw className="h-3 w-3" aria-hidden="true" />
                        重试
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {isGenerating && !messages.some(message => message.status === 'streaming') && (
                <div className="flex items-center gap-2.5">
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
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white p-3.5">
          {error && (
            <div role="alert" className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="rounded-xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
            <textarea
              ref={inputRef}
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSendMessage(input);
                }
              }}
              placeholder="问我任何软考备考问题..."
              rows={2}
              className="max-h-32 min-h-12 w-full resize-none border-0 bg-transparent px-2 py-1 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400"
            />
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-[11px] text-slate-400">Enter 发送，Shift + Enter 换行</span>
              {isGenerating ? (
                <button
                  type="button"
                  onClick={() => void cancelCurrentRun()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white outline-none hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2"
                  aria-label="停止生成"
                  title="停止生成"
                >
                  <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
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
