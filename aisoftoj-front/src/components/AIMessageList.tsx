import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Circle,
  Loader2,
  RotateCcw,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageGroup } from '../lib/aiMessageGroups';
import { RunViewState, ToolStepState } from '../lib/aiEvents';

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

function toolCopy(tool: ToolStepState): { title: string; detail: string } {
  if (tool.status === 'failed') {
    const titles: Record<string, string> = {
      get_my_profile: '读取个人学习概况',
      list_papers: '查询可用试卷',
      get_question: '读取题目信息',
      review_wrong_question: '复盘错题',
      list_practice_history: '查询练习历史',
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
  return {
    title: '执行数据查询',
    detail: tool.status === 'running' ? suffix : '查询已完成',
  };
}

function ToolStep({ tool }: { tool: ToolStepState }) {
  const copy = toolCopy(tool);
  const StatusIcon = tool.status === 'running' ? Loader2 : tool.status === 'failed' ? X : Check;
  return (
    <div className="grid min-h-12 grid-cols-[24px_minmax(0,1fr)] gap-2.5 py-1.5">
      <span className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${
        tool.status === 'failed'
          ? 'bg-red-50 text-red-600'
          : tool.status === 'running'
            ? 'bg-blue-50 text-blue-600'
            : 'bg-emerald-50 text-emerald-600'
      }`}>
        <StatusIcon className={`h-3.5 w-3.5 ${tool.status === 'running' ? 'animate-spin' : ''}`} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{copy.title}</span>
        <span className="mt-0.5 block break-words text-xs leading-5 text-slate-500">
          {copy.detail}
          {tool.durationMs !== undefined && tool.status !== 'running' ? ` · ${tool.durationMs} ms` : ''}
        </span>
      </span>
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
  const completed = run.tools.filter(tool => tool.status !== 'running').length;
  const label = terminal ? `完成 ${completed} 个步骤` : '正在处理';

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
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />
        )}
        <span className="font-medium">{label}</span>
        <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && <div className="pb-1">{run.tools.map(tool => <ToolStep key={tool.callId} tool={tool} />)}</div>}
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
            <div className="min-w-0 max-w-[82%] rounded-2xl rounded-tl-md bg-slate-100 px-3.5 py-2.5 text-sm leading-6 text-slate-800">
              <div className="prose prose-sm max-w-none break-words text-slate-800 prose-p:my-1 prose-table:my-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{group.content}</ReactMarkdown>
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
