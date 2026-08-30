import { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  Circle,
  MessageSquareText,
  RotateCcw,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageGroup } from '../lib/aiMessageGroups';
import {
  ProcessNoteState,
  RunViewState,
  SkillActivationState,
  ToolStepState,
} from '../lib/aiEvents';

type AIMessageListProps = {
  groups: MessageGroup[];
  onRetry: (messageId: string) => void;
};

const QUESTION_TYPES: Record<string, string> = {
  single_choice: '单选题',
  multiple_choice: '多选题',
  judgement: '判断题',
  fill_blank: '填空题',
  case_analysis: '案例分析题',
  essay: '论文题',
  unknown: '题目',
};

const DIFFICULTIES: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
  unknown: '未知难度',
};

function integer(summary: Record<string, unknown> | undefined, key: string): number {
  const value = summary?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

type KnowledgeSource = {
  title: string;
  headingPath: string[];
  pageStart?: number;
  pageEnd?: number;
  evidence: string;
};

function knowledgeSources(summary: Record<string, unknown> | undefined): KnowledgeSource[] {
  const sources = summary?.sources;
  if (!Array.isArray(sources)) return [];
  return sources.flatMap((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const source = value as Record<string, unknown>;
    if (typeof source.title !== 'string' || typeof source.evidence !== 'string') return [];
    const headingPath = Array.isArray(source.heading_path)
      ? source.heading_path.filter((item): item is string => typeof item === 'string')
      : [];
    return [{
      title: source.title,
      headingPath,
      pageStart: typeof source.page_start === 'number' ? source.page_start : undefined,
      pageEnd: typeof source.page_end === 'number' ? source.page_end : undefined,
      evidence: source.evidence,
    }];
  });
}

function KnowledgeSources({ summary }: { summary: Record<string, unknown> | undefined }) {
  const sources = knowledgeSources(summary);
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900"
        aria-expanded={open}
      >
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        {open ? '收起命中片段' : `查看 ${sources.length} 个命中片段`}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="mt-2 space-y-2 border-l-2 border-blue-100 pl-3">
          {sources.map((source, index) => {
            const page = source.pageStart
              ? source.pageEnd && source.pageEnd !== source.pageStart
                ? `第 ${source.pageStart}-${source.pageEnd} 页`
                : `第 ${source.pageStart} 页`
              : '';
            return (
              <div key={`${source.title}-${index}`} className="rounded-md bg-slate-50 px-3 py-2.5">
                <div className="text-xs font-medium text-slate-700">{source.title}</div>
                {(source.headingPath.length > 0 || page) && (
                  <div className="mt-0.5 text-xs text-slate-500">
                    {[source.headingPath.join(' / '), page].filter(Boolean).join(' · ')}
                  </div>
                )}
                <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{source.evidence}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function toolCopy(tool: ToolStepState): { title: string; detail: string } {
  if (tool.status === 'failed') {
    const titles: Record<string, string> = {
      get_my_profile: '读取个人学习概况',
      list_papers: '查询可用试卷',
      get_question: '读取题目信息',
      review_wrong_question: '复盘错题',
      list_practice_history: '查询练习历史',
      describe_skill: '检索可用 Skill',
      load_skill: '读取 Skill 参考资料',
      trace_question_to_textbook: '查找教材出处',
      search_knowledge: '检索学习资料',
    };
    return { title: titles[tool.toolName] || '执行数据查询', detail: '该步骤未完成' };
  }
  const suffix = tool.status === 'running' ? '正在处理' : '';
  if (tool.toolName === 'get_my_profile') {
    return {
      title: '读取个人学习概况',
      detail: tool.status === 'running'
        ? suffix
        : `已读取 ${integer(tool.summary, 'practice_session_count')} 次练习和 ${integer(tool.summary, 'wrong_question_count')} 道错题`,
    };
  }
  if (tool.toolName === 'list_papers') {
    return {
      title: '查询可用试卷',
      detail: tool.status === 'running' ? suffix : `找到 ${integer(tool.summary, 'total')} 份试卷`,
    };
  }
  if (tool.toolName === 'get_question') {
    const type = String(tool.summary?.question_type || 'unknown');
    const difficulty = String(tool.summary?.difficulty || 'unknown');
    return {
      title: '读取题目信息',
      detail: tool.status === 'running'
        ? suffix
        : `已读取${DIFFICULTIES[difficulty] || '未知难度'}${QUESTION_TYPES[type] || '题目'}`,
    };
  }
  if (tool.toolName === 'review_wrong_question') {
    return {
      title: '复盘错题',
      detail: tool.status === 'running'
        ? suffix
        : `已读取错题记录，累计错 ${integer(tool.summary, 'error_count')} 次`,
    };
  }
  if (tool.toolName === 'list_practice_history') {
    return {
      title: '查询练习历史',
      detail: tool.status === 'running'
        ? suffix
        : `已读取 ${integer(tool.summary, 'record_count')} 条记录，共 ${integer(tool.summary, 'total_count')} 次练习`,
    };
  }
  if (tool.toolName === 'describe_skill') {
    return {
      title: '检索可用 Skill',
      detail: tool.status === 'running'
        ? suffix
        : `找到 ${integer(tool.summary, 'total')} 个相关 Skill`,
    };
  }
  if (tool.toolName === 'load_skill') {
    return {
      title: '读取 Skill 参考资料',
      detail: tool.status === 'running'
        ? suffix
        : tool.summary?.truncated === true ? '已加载部分 Skill 资料' : 'Skill 资料已加载',
    };
  }
  if (tool.toolName === 'trace_question_to_textbook') {
    const status = String(tool.summary?.status || 'unknown');
    const details: Record<string, string> = {
      found: '教材出处查询完成',
      insufficient_evidence: '未找到可靠教材出处',
      unavailable: '教材溯源暂不可用',
    };
    return {
      title: '查找教材出处',
      detail: tool.status === 'running' ? '正在检索教材' : (details[status] || '教材出处查询完成'),
    };
  }
  if (tool.toolName === 'search_knowledge') {
    const status = String(tool.summary?.status || 'unknown');
    const details: Record<string, string> = {
      found: `命中 ${integer(tool.summary, 'source_count')} 个资料片段`,
      not_found: '未找到相关资料片段',
      unavailable: '知识库暂不可用',
    };
    return {
      title: '检索学习资料',
      detail: tool.status === 'running' ? '正在检索知识库' : (details[status] || '检索已完成'),
    };
  }
  return {
    title: '执行数据查询',
    detail: tool.status === 'running' ? suffix : '查询已完成',
  };
}

const SKILL_NAMES: Record<string, string> = {
  'essay-writing-coach': '论文写作辅导 Skill',
  'question-explanation': '题目讲解 Skill',
};

function SkillActivationStep({ activation }: { activation: SkillActivationState }) {
  const title = SKILL_NAMES[activation.skillName] || `${activation.skillName} Skill`;
  return (
    <div className="grid min-h-12 grid-cols-[24px_minmax(0,1fr)] gap-2.5 py-1.5">
      <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-violet-50 text-violet-600">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">启用{title}</span>
        <span className="mt-0.5 block break-words text-xs leading-5 text-slate-500">
          已应用 /{activation.skillName} 工作规程
        </span>
      </span>
    </div>
  );
}

function ToolStep({ tool }: { tool: ToolStepState }) {
  const copy = toolCopy(tool);
  const StatusIcon = tool.status === 'failed' ? X : Check;
  return (
    <div className="grid min-h-12 grid-cols-[24px_minmax(0,1fr)] gap-2.5 py-1.5">
      <span className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${
        tool.status === 'failed'
          ? 'bg-red-50 text-red-600'
          : tool.status === 'running'
            ? 'bg-blue-50 text-blue-600'
            : 'bg-emerald-50 text-emerald-600'
      }`}>
        {tool.status === 'running'
          ? <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
          : <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />}
      </span>
      <div className="min-w-0">
        <span className={`block text-sm font-medium ${tool.status === 'running' ? 'ai-sweep-text' : 'text-slate-800'}`}>
          {copy.title}
        </span>
        <span className="mt-0.5 block break-words text-xs leading-5 text-slate-500">
          {copy.detail}
          {tool.durationMs !== undefined && tool.status !== 'running' ? ` · ${tool.durationMs} ms` : ''}
        </span>
        {tool.toolName === 'search_knowledge' && tool.status === 'completed' && (
          <KnowledgeSources summary={tool.summary} />
        )}
      </div>
    </div>
  );
}

function ProcessNote({ note, active }: { note: ProcessNoteState; active: boolean }) {
  return (
    <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-2.5 py-1.5">
      <span className="mt-0.5 flex h-6 w-6 items-center justify-center text-slate-400">
        <MessageSquareText className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className={`min-w-0 whitespace-pre-wrap break-words text-sm leading-6 ${active ? 'ai-sweep-text' : 'text-slate-600'}`}>
        {note.text}
      </p>
    </div>
  );
}

function isTerminal(run: RunViewState) {
  return ['completed', 'failed', 'cancelled', 'interrupted'].includes(run.phase);
}

function ProcessingPanel({ run }: { run: RunViewState }) {
  const terminal = isTerminal(run);
  const [open, setOpen] = useState(!terminal);
  useEffect(() => setOpen(!terminal), [terminal]);
  const completed = run.skillActivations.length
    + run.tools.filter(tool => tool.status !== 'running').length;
  const label = terminal ? `完成 ${completed} 个步骤` : '正在处理';
  const timeline = [
    ...run.processNotes.map(note => ({ kind: 'note' as const, sequence: note.sequence, note })),
    ...run.skillActivations.map(activation => ({
      kind: 'skill' as const,
      sequence: activation.sequence,
      activation,
    })),
    ...run.tools.map(tool => ({ kind: 'tool' as const, sequence: tool.sequence, tool })),
  ].sort((left, right) => left.sequence - right.sequence);

  return (
    <div className="ml-10 border-l-2 border-slate-200 pl-3">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex min-h-9 w-full items-center gap-2 text-left text-sm text-slate-600 outline-none hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600"
        aria-expanded={open}
      >
        {terminal ? (
          <Wrench className="h-4 w-4 text-slate-500" aria-hidden="true" />
        ) : (
          <Sparkles className="h-4 w-4 text-blue-600" aria-hidden="true" />
        )}
        <span className={`font-medium ${terminal ? '' : 'ai-sweep-text'}`}>{label}</span>
        <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="pb-1">
            {timeline.map((item, index) => item.kind === 'note'
              ? <ProcessNote key={`note-${item.sequence}-${index}`} note={item.note} active={!terminal && index === timeline.length - 1} />
              : item.kind === 'skill'
                ? <SkillActivationStep key={`skill-${item.sequence}`} activation={item.activation} />
                : <ToolStep key={item.tool.callId} tool={item.tool} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function AssistantMark() {
  return (
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
      <Sparkles className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

function RunErrorNotice({ group }: { group: Extract<MessageGroup, { type: 'assistant:error' }> }) {
  const copy = group.errorCode === 'AUTH_EXPIRED'
    ? '登录状态已失效，请重新登录'
    : group.phase === 'cancelled'
    ? '已停止生成'
    : group.phase === 'interrupted'
      ? 'AI 服务已重启，本次回答中断'
      : '回答生成失败，请重试';
  return (
    <div className="ml-10 flex items-center gap-2 text-xs text-red-700" role="status">
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{copy}</span>
    </div>
  );
}

export function AIMessageList({ groups, onRetry }: AIMessageListProps) {
  return (
    <div className="space-y-5 px-4 py-5">
      {groups.map(group => {
        if (group.type === 'human') {
          return (
            <div key={group.key} className="flex justify-end gap-2.5">
              <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-blue-600 px-3.5 py-2.5 text-sm leading-6 text-white">
                {group.message.content}
                {group.message.status === 'failed' && (
                  <button
                    type="button"
                    onClick={() => onRetry(group.message.id)}
                    className="mt-2 flex items-center gap-1 text-xs font-medium text-red-100 underline underline-offset-2"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    重试
                  </button>
                )}
              </div>
            </div>
          );
        }
        if (group.type === 'assistant:processing') {
          return <ProcessingPanel key={group.key} run={group.run} />;
        }
        if (group.type === 'assistant:error') {
          return <RunErrorNotice key={group.key} group={group} />;
        }
        return (
          <div key={group.key} className="flex items-start gap-2.5">
            <AssistantMark />
            <div className="min-w-0 max-w-[82%] rounded-2xl rounded-tl-md border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm shadow-slate-200/30">
              <div className="markdown-body break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ children }) => (
                      <div className="markdown-table-scroll"><table>{children}</table></div>
                    ),
                    a: ({ children, href }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                    ),
                  }}
                >
                  {group.content}
                </ReactMarkdown>
              </div>
              {group.streaming && (
                <span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400">
                  <Circle className="h-2 w-2 fill-blue-500 text-blue-500" aria-hidden="true" />
                  生成中
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
