import { getMessageGroups } from './aiMessageGroups';
import { ConversationMessage, RunViewState, createRunViewState } from './aiEvents';

function message(overrides: Partial<ConversationMessage>): ConversationMessage {
  return {
    id: 'message',
    role: 'user',
    content: '问题',
    status: 'sent',
    ...overrides,
  };
}

describe('AI message grouping', () => {
  it('projects one run exactly once in human, processing and answer order', () => {
    const run: RunViewState = {
      ...createRunViewState('run-1'),
      phase: 'completed',
      answer: '流式草稿',
      tools: [{
        callId: 'call-1',
        toolName: 'list_papers',
        input: {},
        status: 'completed',
        sequence: 2,
        summary: { total: 12 },
      }],
    };
    const groups = getMessageGroups([
      message({ id: 'user-1', runId: 'run-1', sequence: 1 }),
      message({
        id: 'assistant-1',
        runId: 'run-1',
        role: 'assistant',
        content: '服务端最终回答',
        sequence: 2,
      }),
    ], { 'run-1': run });

    expect(groups.map(group => group.type)).toEqual([
      'human',
      'assistant:processing',
      'assistant:answer',
    ]);
    expect(groups[2]).toMatchObject({ content: '服务端最终回答' });
  });

  it('keeps legacy answers without rendering an empty process panel', () => {
    const groups = getMessageGroups([
      message({ id: 'user-1', runId: 'run-1', sequence: 1 }),
      message({
        id: 'assistant-1',
        runId: 'run-1',
        role: 'assistant',
        content: '旧回答',
        sequence: 2,
      }),
    ], { 'run-1': { ...createRunViewState('run-1'), phase: 'completed' } });

    expect(groups.map(group => group.type)).toEqual(['human', 'assistant:answer']);
  });
});
