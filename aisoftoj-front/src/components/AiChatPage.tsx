import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  Brain,
  ChevronDown,
  Database,
  ExternalLink,
  FileText,
  Globe2,
  Menu,
  MessageSquarePlus,
  Send,
  Square,
  Trash2,
  UserRound,
  WifiOff,
  X,
} from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import {
  AiChatAgentEvent,
  AiChatCitation,
  AiChatMessage,
  AiChatSession,
  KnowledgeBase,
  createAiChatSession,
  deleteAiChatSession,
  getAiChatSession,
  listAiChatSessions,
  listKnowledgeBases,
  loadKnowledgeCitationAsset,
  streamAiChatMessage,
  updateAiChatKnowledgeBases,
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';

function SessionList({
  sessions,
  activeId,
  onSelect,
  onDelete,
  onCreate,
}: {
  sessions: AiChatSession[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onCreate: () => void;
}) {
  return (
    <div className="ai-chat-session-list">
      <div className="ai-chat-sidebar-header">
        <p className="ai-chat-sidebar-title">历史对话</p>
        <Button className="app-primary-button w-full" onClick={onCreate}>
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          新建对话
        </Button>
      </div>
      <div className="ai-chat-session-scroll">
        {sessions.length === 0 ? (
          <div className="px-3 py-10 text-center text-sm app-meta">暂无历史对话</div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`ai-chat-session-item group ${activeId === session.id ? 'is-active' : ''}`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 px-3 py-2.5 text-left"
                onClick={() => onSelect(session.id)}
              >
                <span className="block truncate text-sm font-medium">{session.title}</span>
                <span className="mt-0.5 block text-xs app-meta">
                  {new Date(session.updateTime).toLocaleDateString('zh-CN')}
                </span>
              </button>
              <button
                type="button"
                className="ai-chat-delete-button"
                aria-label={`删除对话 ${session.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(session.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ReasoningBlock({ message }: { message: AiChatMessage }) {
  const [isOpen, setIsOpen] = useState(message.status === 'streaming');

  useEffect(() => {
    if (message.status === 'streaming' && message.reasoningContent) {
      setIsOpen(true);
    }
  }, [message.reasoningContent, message.status]);

  if (!message.reasoningContent) {
    return null;
  }

  return (
    <details
      className="ai-chat-reasoning"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="flex items-center gap-2">
          <Brain className="h-4 w-4" />
          {message.status === 'streaming' ? '正在思考' : '查看思考过程'}
        </span>
        <ChevronDown className="ai-chat-reasoning-chevron h-4 w-4" />
      </summary>
      <div className="ai-chat-reasoning-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.reasoningContent}</ReactMarkdown>
      </div>
    </details>
  );
}

function CitationViewer({
  citation,
  onClose,
}: {
  citation: AiChatCitation | null;
  onClose: () => void;
}) {
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    setImageUrl('');

    if (
      citation?.content_type === 'image'
      && citation.document_id
      && citation.version != null
      && citation.asset_name
    ) {
      void loadKnowledgeCitationAsset(
        citation.document_id,
        citation.version,
        citation.asset_name,
      ).then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setImageUrl(url);
      }).catch(() => setImageUrl(''));
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [citation]);

  if (!citation || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-950/35 backdrop-blur-[1px]"
        aria-label="关闭检索详情"
        onClick={onClose}
      />
      <aside
        className="relative flex max-h-[86dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        aria-label="检索结果详情"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-6 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-teal-50 p-2 text-teal-700">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-6 app-title">
                [{citation.index}] {citation.title}
              </h3>
              <p className="mt-1 text-xs app-meta">
                {citation.source}
                {citation.page != null ? ` · 第 ${citation.page + 1} 页` : ''}
                {citation.score > 0 ? ` · 融合得分 ${citation.score.toFixed(4)}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="关闭检索详情"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {imageUrl && (
            <figure className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3">
              <img
                src={imageUrl}
                alt={citation.content || citation.title}
                className="mx-auto max-h-[42dvh] w-auto rounded-lg object-contain"
              />
            </figure>
          )}
          {citation.heading_path?.length > 0 && (
            <section className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium app-meta">文档位置</p>
              <p className="mt-1 text-sm leading-6 app-body">
                {citation.heading_path.join(' / ')}
              </p>
            </section>
          )}

          <section>
            <p className="mb-2 text-xs font-medium app-meta">实际检索片段</p>
            <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 app-body">
              {citation.content || '该历史引用未保存检索片段，请重新提问。'}
            </div>
          </section>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs app-meta">
            <span className="break-all">
              {citation.document_id
                ? `文档 ID：${citation.document_id}`
                : `结果 ID：${citation.result_id || '未知'}`}
            </span>
            {citation.url && (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <a href={citation.url} target="_blank" rel="noreferrer">
                  打开原网页
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function AssistantContent({ message }: { message: AiChatMessage }) {
  const [selectedCitation, setSelectedCitation] = useState<AiChatCitation | null>(null);

  return (
    <div>
      {message.agentEvents?.length ? (
        <div className="ai-chat-agent-events">
          {message.agentEvents.map((event, index) => (
            <div key={`${event.type}-${index}`} className={`ai-chat-agent-event is-${event.type}`}>
              <span>{event.title}</span>
              <p>{event.message}</p>
            </div>
          ))}
        </div>
      ) : null}
      <ReasoningBlock message={message} />
      <div className="ai-chat-markdown text-sm leading-7 app-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content || (message.status === 'streaming' ? '正在生成回答…' : '')}
        </ReactMarkdown>
      </div>
      {message.citations?.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-medium app-meta">参考来源</p>
          <div className="flex flex-wrap gap-2">
            {message.citations.map((citation) => (
              <button
                type="button"
                key={`${citation.index}-${citation.url || citation.title}`}
                onClick={() => setSelectedCitation(citation)}
                className="app-chip cursor-pointer px-2.5 py-1.5 text-left text-xs app-body transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
              >
                [{citation.index}] {citation.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <CitationViewer
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
      {message.status === 'failed' && (
        <p className="mt-3 text-xs text-red-600">{message.errorMessage || '回答生成失败'}</p>
      )}
    </div>
  );
}

export default function AiChatPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<number[]>([]);
  const [input, setInput] = useState('');
  const [webEnabled, setWebEnabled] = useState(false);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadSession = useCallback(async (sessionId: number) => {
    setError('');
    const session = await getAiChatSession(sessionId);
    setActiveId(session.id);
    setMessages(session.messages || []);
    setSelectedKnowledgeBaseIds(session.knowledgeBaseIds || []);
    setMobileOpen(false);
  }, []);

  const refreshSessions = useCallback(async () => {
    const data = await listAiChatSessions();
    setSessions(data);
    return data;
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([listAiChatSessions(), listKnowledgeBases()])
      .then(async ([data, loadedKnowledgeBases]) => {
        if (!mounted) return;
        setSessions(data);
        setKnowledgeBases(loadedKnowledgeBases);
        if (data.length > 0) {
          const detail = await getAiChatSession(data[0].id);
          if (mounted) {
            setActiveId(detail.id);
            setMessages(detail.messages || []);
            setSelectedKnowledgeBaseIds(detail.knowledgeBaseIds || []);
          }
        }
      })
      .catch((loadError) => mounted && setError((loadError as Error).message))
      .finally(() => mounted && setIsLoading(false));

    return () => {
      mounted = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prompt = params.get('prompt');
    if (!prompt) return;
    setInput(prompt);
    params.delete('prompt');
    const nextSearch = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`,
    );
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: isStreaming ? 'smooth' : 'auto' });
  }, [messages, isStreaming, statusText]);

  const createSession = async () => {
    if (isStreaming) return;
    try {
      const session = await createAiChatSession();
      setSessions((current) => [session, ...current]);
      setActiveId(session.id);
      setMessages([]);
      setSelectedKnowledgeBaseIds(session.knowledgeBaseIds || []);
      setError('');
      setWarning('');
      setMobileOpen(false);
    } catch (createError) {
      setError((createError as Error).message);
    }
  };

  const removeSession = async (sessionId: number) => {
    if (!window.confirm('确定删除这条对话吗？')) return;
    try {
      await deleteAiChatSession(sessionId);
      const latest = await refreshSessions();
      const remaining = latest.filter((session) => session.id !== sessionId);
      setSessions(remaining);
      if (activeId === sessionId) {
        if (remaining.length > 0) {
          await loadSession(remaining[0].id);
        } else {
          setActiveId(null);
          setMessages([]);
        }
      }
    } catch (deleteError) {
      setError((deleteError as Error).message);
    }
  };

  const updateAssistant = (id: string, updater: (message: AiChatMessage) => AiChatMessage) => {
    setMessages((current) => current.map((message) => (message.id === id ? updater(message) : message)));
  };

  const appendAgentEvent = (assistantId: string, event: AiChatAgentEvent) => {
    updateAssistant(assistantId, (message) => ({
      ...message,
      agentEvents: [...(message.agentEvents || []), event],
    }));
  };

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || isStreaming) return;

    setInput('');
    setError('');
    setWarning('');
    setStatusText('问题已发送，正在连接 AI 助手');
    setIsStreaming(true);

    try {
      let sessionId = activeId;
      if (!sessionId) {
        const created = await createAiChatSession();
        sessionId = created.id;
        setActiveId(created.id);
        setSessions((current) => [created, ...current]);
      }

      const now = new Date().toISOString();
      const assistantId = `stream-${Date.now()}`;
      setMessages((current) => [
        ...current,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: question,
          webEnabled,
          thinkingEnabled,
          reasoningContent: '',
          status: 'completed',
          citations: [],
          createTime: now,
        },
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          webEnabled,
          thinkingEnabled,
          reasoningContent: '',
          status: 'streaming',
          citations: [],
          agentEvents: [],
          createTime: now,
        },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;
      await streamAiChatMessage(
        sessionId,
        question,
        webEnabled,
        thinkingEnabled,
        {
          onStatus: setStatusText,
          onWarning: setWarning,
          onAgentAction: (event) => {
            setStatusText(event.message || event.title);
            appendAgentEvent(assistantId, event);
          },
          onToolResult: (event) => appendAgentEvent(assistantId, event),
          onMemoryUpdate: (event) => appendAgentEvent(assistantId, event),
          onToken: (token) => updateAssistant(assistantId, (message) => ({
            ...message,
            content: message.content + token,
          })),
          onReasoning: (token) => updateAssistant(assistantId, (message) => ({
            ...message,
            reasoningContent: `${message.reasoningContent || ''}${token}`,
          })),
          onCitation: (citations) => updateAssistant(assistantId, (message) => ({
            ...message,
            citations,
          })),
          onDone: () => setStatusText(''),
        },
        controller.signal
      );

      await refreshSessions();
      await loadSession(sessionId);
    } catch (streamError) {
      if ((streamError as Error).name !== 'AbortError') {
        setError((streamError as Error).message);
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
      setStatusText('');
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    setStatusText('已停止生成');
    setIsStreaming(false);
  };

  const toggleKnowledgeBase = async (knowledgeBaseId: number, checked: boolean) => {
    if (!activeId || isStreaming) return;
    const next = checked
      ? Array.from(new Set([...selectedKnowledgeBaseIds, knowledgeBaseId]))
      : selectedKnowledgeBaseIds.filter((id) => id !== knowledgeBaseId);
    setSelectedKnowledgeBaseIds(next);
    try {
      const updated = await updateAiChatKnowledgeBases(activeId, next);
      setSelectedKnowledgeBaseIds(updated.knowledgeBaseIds || []);
      setSessions((current) => current.map((session) =>
        session.id === activeId ? { ...session, knowledgeBaseIds: updated.knowledgeBaseIds } : session));
    } catch (updateError) {
      setError((updateError as Error).message);
      const current = await getAiChatSession(activeId);
      setSelectedKnowledgeBaseIds(current.knowledgeBaseIds || []);
    }
  };

  return (
    <main className="ai-chat-page">
      <div className="ai-chat-page-content">
        <div className="ai-chat-layout">
          <aside className="app-panel-muted ai-chat-sidebar">
            <SessionList
              sessions={sessions}
              activeId={activeId}
              onSelect={loadSession}
              onDelete={removeSession}
              onCreate={createSession}
            />
          </aside>

          <section className="ai-chat-main">
            <div className="app-toolbar ai-chat-toolbar">
              <div className="flex min-w-0 items-center gap-3">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="lg:hidden" aria-label="打开历史对话">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[86%] gap-0 p-0">
                    <SheetHeader className="border-b border-slate-200">
                      <SheetTitle>历史对话</SheetTitle>
                    </SheetHeader>
                    <SessionList
                      sessions={sessions}
                      activeId={activeId}
                      onSelect={loadSession}
                      onDelete={removeSession}
                      onCreate={createSession}
                    />
                  </SheetContent>
                </Sheet>
                <div className="app-page-icon">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="app-title truncate text-sm font-semibold">
                    {sessions.find((session) => session.id === activeId)?.title || 'AI 备考助手'}
                  </h1>
                  <p className="text-xs app-meta">软考知识解释、概念对比与复习建议</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 gap-2">
                      <Database className="h-4 w-4" />
                      <span className="hidden sm:inline">知识库</span>
                      <span className="rounded-full bg-slate-100 px-1.5 text-xs">
                        {selectedKnowledgeBaseIds.length}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80">
                    <div className="mb-3">
                      <strong className="text-sm">本会话检索范围</strong>
                      <p className="mt-1 text-xs app-meta">选择会被保存到当前会话，不会检索其他资料。</p>
                    </div>
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {knowledgeBases.length === 0 ? (
                        <p className="py-6 text-center text-sm app-meta">暂无知识库</p>
                      ) : knowledgeBases.map((base) => (
                        <label key={base.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
                          <Checkbox
                            checked={selectedKnowledgeBaseIds.includes(base.id)}
                            onCheckedChange={(checked) => void toggleKnowledgeBase(base.id, checked === true)}
                            disabled={!activeId || isStreaming}
                          />
                          <span className="min-w-0">
                            <strong className="block truncate text-sm">{base.name}</strong>
                            <span className="text-xs app-meta">{base.readyCount}/{base.documentCount} 个文档可检索</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="app-chip ai-chat-web-toggle">
                  {webEnabled ? <Globe2 className="h-4 w-4 text-teal-700" /> : <WifiOff className="h-4 w-4 app-meta" />}
                  <label htmlFor="web-search" className="text-xs font-medium app-body">联网</label>
                  <Switch
                    id="web-search"
                    checked={webEnabled}
                    onCheckedChange={setWebEnabled}
                    disabled={isStreaming}
                  />
                </div>
                <div className="app-chip ai-chat-web-toggle">
                  <Brain className={`h-4 w-4 ${thinkingEnabled ? 'text-teal-700' : 'app-meta'}`} />
                  <label htmlFor="thinking-mode" className="text-xs font-medium app-body">思考</label>
                  <Switch
                    id="thinking-mode"
                    checked={thinkingEnabled}
                    onCheckedChange={setThinkingEnabled}
                    disabled={isStreaming}
                  />
                </div>
              </div>
            </div>

            <div className="ai-chat-messages">
              {isLoading ? (
                <div className="mx-auto max-w-3xl space-y-4">
                  <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                  <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
                </div>
              ) : messages.length === 0 ? (
                <div className="ai-chat-welcome">
                  <div className="app-page-icon mb-5 h-14 w-14">
                    <Bot className="h-8 w-8" />
                  </div>
                  <h2 className="app-title text-2xl font-semibold tracking-tight">今天想弄懂什么？</h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 app-body">
                    可以询问软考知识点、架构设计、项目管理或复习方法。联网搜索默认关闭，需要最新公开资料时再开启。
                  </p>
                  <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                    {[
                      '用表格对比 CAP 和 BASE 理论',
                      '分析我的错题并找出最薄弱知识点',
                      '解释软件架构中的质量属性',
                      '找数据库优化相关错题并给我复盘建议',
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="app-chip ai-chat-quick-question"
                        onClick={() => setInput(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="ai-chat-thread">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`ai-chat-message-wrap is-${message.role}`}
                    >
                      {message.role === 'user' ? (
                        <div className="ai-chat-message-row ai-chat-user-row">
                          <div className="ai-chat-user-avatar">
                            {user?.avatar ? (
                              <img src={user.avatar} alt="" className="h-full w-full rounded-[9px] object-cover" />
                            ) : (
                              <UserRound className="h-4 w-4" />
                            )}
                          </div>
                          <div className="ai-chat-user-message">{message.content}</div>
                        </div>
                      ) : (
                        <div className="ai-chat-message-row ai-chat-assistant-row">
                          <div className="ai-chat-assistant-icon">
                            <Bot className="h-4 w-4" />
                          </div>
                          <div className="ai-chat-assistant-message">
                            <AssistantContent message={message} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            <div className="ai-chat-composer-area">
              <div className="ai-chat-composer-inner">
                {(warning || error || statusText) && (
                  <div className={`mb-2 text-xs ${error ? 'text-red-600' : warning ? 'text-amber-600' : 'app-meta'}`}>
                    {error || warning || statusText}
                  </div>
                )}
                <div className="app-input-shell ai-chat-composer">
                  <Textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder="输入你的问题，Shift + Enter 换行"
                    className="max-h-40 min-h-11 resize-none border-0 bg-transparent px-3 py-2 shadow-none focus-visible:ring-0"
                    disabled={isStreaming}
                  />
                  {isStreaming ? (
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-10 w-10 shrink-0 rounded-xl"
                      onClick={stopStreaming}
                      aria-label="停止生成"
                    >
                      <Square className="h-4 w-4 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      className="app-primary-button h-10 w-10 shrink-0 rounded-xl"
                      onClick={() => void sendMessage()}
                      disabled={!input.trim()}
                      aria-label="发送问题"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-center text-[11px] app-meta">
                  AI 回答可能存在偏差，重要结论请结合教材与官方资料核验。
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
