import { ConversationMessage, RunViewState } from './aiEvents';

export type MessageGroup =
  | { type: 'human'; key: string; message: ConversationMessage }
  | { type: 'assistant:processing'; key: string; run: RunViewState }
  | { type: 'assistant:answer'; key: string; content: string; streaming: boolean }
  | { type: 'assistant:error'; key: string; phase: RunViewState['phase']; errorCode?: string };

export function getMessageGroups(
  messages: ConversationMessage[],
  runStates: Record<string, RunViewState>,
): MessageGroup[] {
  const sorted = [...messages].sort((left, right) => {
    if (left.sequence === undefined || right.sequence === undefined) return 0;
    return left.sequence - right.sequence;
  });
  const assistantByRun = new Map(
    sorted
      .filter(message => message.role === 'assistant' && message.runId)
      .map(message => [message.runId as string, message]),
  );
  const groups: MessageGroup[] = [];

  sorted.filter(message => message.role === 'user').forEach(message => {
    const runId = message.runId || message.id;
    const run = message.runId ? runStates[message.runId] : undefined;
    const assistant = message.runId ? assistantByRun.get(message.runId) : undefined;
    groups.push({ type: 'human', key: `${runId}:human`, message });
    if (run && (run.tools.length || run.processNotes.length)) {
      groups.push({ type: 'assistant:processing', key: `${runId}:processing`, run });
    }
    const answer = assistant?.content || run?.answer || '';
    if (answer) {
      groups.push({
        type: 'assistant:answer',
        key: `${runId}:answer`,
        content: answer,
        streaming: !assistant && run?.phase === 'streaming',
      });
    }
    if (run && ['failed', 'cancelled', 'interrupted'].includes(run.phase)) {
      groups.push({
        type: 'assistant:error',
        key: `${runId}:error`,
        phase: run.phase,
        errorCode: run.errorCode,
      });
    }
  });
  return groups;
}
