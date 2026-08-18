import { AIRun, AIRunEvent, AIStreamEvent } from './aiApi';
import {
  applyEvent,
  applyRunSnapshot,
  createRunViewState,
  normalizeEvent,
} from './aiEvents';

function persisted(sequence: number, type: string, data: Record<string, unknown>): AIRunEvent {
  return {
    run_id: 'run-1',
    sequence,
    type,
    created_at: `2026-08-18T00:00:0${sequence}Z`,
    data,
  };
}

function snapshot(status: AIRun['status'], errorCode: string | null = null): AIRun {
  return {
    id: 'run-1',
    thread_id: 'thread-1',
    status,
    input_message_id: 'user-1',
    output_message_id: status === 'completed' ? 'assistant-1' : null,
    error_code: errorCode,
    model_name: 'test',
    created_at: '2026-08-18T00:00:00Z',
    updated_at: '2026-08-18T00:01:00Z',
  };
}

describe('AI event normalization and reduction', () => {
  it('maps persisted message deltas and advances unknown event envelopes', () => {
    const delta = normalizeEvent(persisted(1, 'message.delta', { delta: '你好' }));
    const unknown = normalizeEvent(persisted(2, 'future.event', { reasoning: 'must-not-pass' }));

    expect(delta?.event).toMatchObject({ type: 'answer.delta', text: '你好' });
    expect(unknown).toEqual({ sequence: 2, event: null });
  });

  it('pairs tools by call id and ignores replayed sequences', () => {
    const raws = [
      persisted(1, 'run.started', {}),
      persisted(2, 'tool.started', {
        call_id: 'call-1',
        tool_name: 'list_papers',
        input: {},
      }),
      persisted(3, 'tool.completed', {
        call_id: 'call-1',
        tool_name: 'list_papers',
        summary: { total: 12 },
        duration_ms: 20,
      }),
      persisted(4, 'message.delta', { delta: '完成' }),
      persisted(5, 'run.completed', { status: 'completed' }),
    ];
    let state = createRunViewState('run-1');
    raws.forEach(raw => {
      const normalized = normalizeEvent(raw);
      if (normalized?.event) state = applyEvent(state, normalized.event);
    });
    const replayed = normalizeEvent(raws[3]);
    if (replayed?.event) state = applyEvent(state, replayed.event);

    expect(state.phase).toBe('completed');
    expect(state.answer).toBe('完成');
    expect(state.tools).toEqual([{
      callId: 'call-1',
      toolName: 'list_papers',
      input: {},
      status: 'completed',
      summary: { total: 12 },
      durationMs: 20,
    }]);
  });

  it('produces the same state from SSE and persisted history', () => {
    const history = [
      persisted(1, 'run.started', {}),
      persisted(2, 'message.delta', { delta: '第一段' }),
      persisted(3, 'message.delta', { delta: '第二段' }),
      persisted(4, 'run.completed', {}),
    ];
    const stream: AIStreamEvent[] = history.map(item => ({
      event: item.type,
      id: item.sequence,
      data: item,
    }));
    const reduce = (items: Array<AIRunEvent | AIStreamEvent>) => items.reduce((state, raw) => {
      const normalized = normalizeEvent(raw, 'run-1');
      return normalized?.event ? applyEvent(state, normalized.event) : state;
    }, createRunViewState('run-1'));

    expect(reduce(stream)).toEqual(reduce(history));
  });

  it('uses a run snapshot to recover missing terminal events', () => {
    const state = applyRunSnapshot(createRunViewState('run-1'), snapshot('interrupted', 'SERVICE_RESTARTED'));

    expect(state.phase).toBe('interrupted');
    expect(state.errorCode).toBe('SERVICE_RESTARTED');
  });
});
