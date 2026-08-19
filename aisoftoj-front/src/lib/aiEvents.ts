import { AIMessage, AIRun, AIRunContext, AIRunEvent, AIStreamEvent } from './aiApi';

export type ToolStepState = {
  callId: string;
  toolName: string;
  input: Record<string, unknown>;
  status: 'running' | 'completed' | 'failed';
  summary?: Record<string, unknown>;
  message?: string;
  durationMs?: number;
};

export type RunPhase =
  | 'idle'
  | 'running'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export type RunViewState = {
  runId: string;
  phase: RunPhase;
  lastAppliedSequence: number;
  tools: ToolStepState[];
  answer: string;
  planTasks: never[];
  subtasks: never[];
  startedAt?: string;
  finishedAt?: string;
  errorCode?: string;
};

type EventBase = { runId: string; sequence: number; createdAt?: string };

export type NormalizedRunEvent =
  | (EventBase & { type: 'run.started' })
  | (EventBase & { type: 'answer.delta'; text: string })
  | (EventBase & {
      type: 'tool.started';
      callId: string;
      toolName: string;
      input: Record<string, unknown>;
    })
  | (EventBase & {
      type: 'tool.completed';
      callId: string;
      toolName: string;
      summary: Record<string, unknown>;
      durationMs?: number;
    })
  | (EventBase & {
      type: 'tool.failed';
      callId: string;
      toolName: string;
      message: string;
      durationMs?: number;
    })
  | (EventBase & {
      type: 'run.completed' | 'run.failed' | 'run.cancelled' | 'run.interrupted';
      errorCode?: string;
    });

export type NormalizedEnvelope = {
  sequence: number;
  event: NormalizedRunEvent | null;
};

export type ConversationMessage = {
  id: string;
  runId?: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'sent' | 'streaming' | 'failed';
  sequence?: number;
  idempotencyKey?: string;
  context?: AIRunContext;
};

const TERMINAL_EVENT_TYPES = new Set([
  'run.completed',
  'run.failed',
  'run.cancelled',
  'run.interrupted',
]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function normalizeEvent(
  raw: AIStreamEvent | AIRunEvent,
  fallbackRunId?: string,
): NormalizedEnvelope | null {
  const isPersisted = 'type' in raw && 'sequence' in raw;
  const outer = isPersisted ? raw as AIRunEvent : (raw as AIStreamEvent).data;
  const sequenceValue = isPersisted ? (raw as AIRunEvent).sequence : (raw as AIStreamEvent).id ?? outer.sequence;
  const sequence = Number(sequenceValue);
  const runIdValue = isPersisted ? (raw as AIRunEvent).run_id : outer.run_id ?? fallbackRunId;
  if (!Number.isInteger(sequence) || sequence <= 0 || typeof runIdValue !== 'string' || !runIdValue) {
    return null;
  }

  const persistedType = isPersisted ? (raw as AIRunEvent).type : (raw as AIStreamEvent).event;
  const payload = record(isPersisted ? (raw as AIRunEvent).data : outer.data);
  const base = {
    runId: runIdValue,
    sequence,
    createdAt: isPersisted ? (raw as AIRunEvent).created_at : String(outer.created_at || ''),
  };

  if (persistedType === 'run.started') return { sequence, event: { ...base, type: 'run.started' } };
  if (persistedType === 'message.delta') {
    return {
      sequence,
      event: typeof payload.delta === 'string'
        ? { ...base, type: 'answer.delta', text: payload.delta }
        : null,
    };
  }
  if (persistedType === 'tool.started') {
    return {
      sequence,
      event: typeof payload.call_id === 'string' && typeof payload.tool_name === 'string'
        ? {
            ...base,
            type: 'tool.started',
            callId: payload.call_id,
            toolName: payload.tool_name,
            input: record(payload.input),
          }
        : null,
    };
  }
  if (persistedType === 'tool.completed') {
    return {
      sequence,
      event: typeof payload.call_id === 'string' && typeof payload.tool_name === 'string'
        ? {
            ...base,
            type: 'tool.completed',
            callId: payload.call_id,
            toolName: payload.tool_name,
            summary: record(payload.summary),
            durationMs: optionalNumber(payload.duration_ms),
          }
        : null,
    };
  }
  if (persistedType === 'tool.failed') {
    return {
      sequence,
      event: typeof payload.call_id === 'string' && typeof payload.tool_name === 'string'
        ? {
            ...base,
            type: 'tool.failed',
            callId: payload.call_id,
            toolName: payload.tool_name,
            message: typeof payload.message === 'string' ? payload.message : 'tool_execution_failed',
            durationMs: optionalNumber(payload.duration_ms),
          }
        : null,
    };
  }
  if (TERMINAL_EVENT_TYPES.has(persistedType)) {
    return {
      sequence,
      event: {
        ...base,
        type: persistedType as Extract<NormalizedRunEvent, { errorCode?: string }>['type'],
        errorCode: typeof payload.error_code === 'string' ? payload.error_code : undefined,
      },
    };
  }
  return { sequence, event: null };
}

export function createRunViewState(runId: string): RunViewState {
  return {
    runId,
    phase: 'idle',
    lastAppliedSequence: 0,
    tools: [],
    answer: '',
    planTasks: [],
    subtasks: [],
  };
}

function terminalPhase(type: NormalizedRunEvent['type']): RunPhase | null {
  if (type === 'run.completed') return 'completed';
  if (type === 'run.failed') return 'failed';
  if (type === 'run.cancelled') return 'cancelled';
  if (type === 'run.interrupted') return 'interrupted';
  return null;
}

export function isTerminalEvent(event: NormalizedRunEvent): boolean {
  return terminalPhase(event.type) !== null;
}

export function applyEvent(state: RunViewState, event: NormalizedRunEvent): RunViewState {
  if (event.runId !== state.runId || event.sequence <= state.lastAppliedSequence) return state;
  const next = { ...state, lastAppliedSequence: event.sequence };
  if (event.type === 'run.started') {
    return { ...next, phase: 'running', startedAt: event.createdAt || state.startedAt };
  }
  if (event.type === 'answer.delta') {
    return { ...next, phase: 'streaming', answer: state.answer + event.text };
  }
  if (event.type === 'tool.started') {
    const tool: ToolStepState = {
      callId: event.callId,
      toolName: event.toolName,
      input: event.input,
      status: 'running',
    };
    const index = state.tools.findIndex(item => item.callId === event.callId);
    const tools = index >= 0
      ? state.tools.map((item, itemIndex) => itemIndex === index ? tool : item)
      : [...state.tools, tool];
    return { ...next, phase: 'running', tools };
  }
  if (event.type === 'tool.completed' || event.type === 'tool.failed') {
    const index = state.tools.findIndex(item => item.callId === event.callId);
    const current = index >= 0 ? state.tools[index] : {
      callId: event.callId,
      toolName: event.toolName,
      input: {},
      status: 'running' as const,
    };
    const tool: ToolStepState = event.type === 'tool.completed'
      ? { ...current, status: 'completed', summary: event.summary, durationMs: event.durationMs }
      : { ...current, status: 'failed', message: event.message, durationMs: event.durationMs };
    const tools = index >= 0
      ? state.tools.map((item, itemIndex) => itemIndex === index ? tool : item)
      : [...state.tools, tool];
    return { ...next, phase: 'running', tools };
  }
  const phase = terminalPhase(event.type);
  return phase ? {
    ...next,
    phase,
    finishedAt: event.createdAt || state.finishedAt,
    errorCode: 'errorCode' in event ? event.errorCode : undefined,
  } : next;
}

export function applyRunSnapshot(state: RunViewState, run: AIRun): RunViewState {
  const phase = run.status === 'queued' || run.status === 'running'
    ? (state.phase === 'idle' ? 'running' : state.phase)
    : run.status;
  return {
    ...state,
    phase,
    startedAt: state.startedAt || run.created_at,
    finishedAt: ['completed', 'failed', 'cancelled', 'interrupted'].includes(run.status)
      ? run.updated_at
      : state.finishedAt,
    errorCode: run.error_code || state.errorCode,
  };
}

export function toConversationMessage(message: AIMessage): ConversationMessage {
  return {
    id: message.id,
    runId: message.run_id,
    role: message.role,
    content: message.content,
    status: 'sent',
    sequence: message.sequence,
  };
}
