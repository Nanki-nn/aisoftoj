import {
  AIApiError,
  AIRun,
  getAIRun,
  streamAIRun,
} from './aiApi';
import { NormalizedRunEvent, isTerminalEvent, normalizeEvent } from './aiEvents';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'interrupted']);

export type RunSessionResult = {
  run: AIRun;
  transportSequence: number;
};

export async function runAIStreamSession(
  threadId: string,
  run: AIRun,
  initialSequence: number,
  outerSignal: AbortSignal,
  onEvent: (event: NormalizedRunEvent) => void,
): Promise<RunSessionResult> {
  let transportSequence = initialSequence;
  let terminal = false;
  let retriesWithoutProgress = 0;

  while (!outerSignal.aborted && !terminal && retriesWithoutProgress < 3) {
    const beforeAttempt = transportSequence;
    const streamController = new AbortController();
    const abortStream = () => streamController.abort();
    outerSignal.addEventListener('abort', abortStream, { once: true });
    try {
      await streamAIRun(threadId, run.id, transportSequence, streamController.signal, raw => {
        if (raw.event === 'stream.reset') {
          const resetSequence = Number(raw.data.last_sequence);
          if (Number.isFinite(resetSequence)) {
            transportSequence = Math.max(transportSequence, resetSequence);
          }
          return;
        }
        if (raw.event === 'stream.end') {
          terminal = true;
          streamController.abort();
          return;
        }
        const normalized = normalizeEvent(raw, run.id);
        if (!normalized) return;
        transportSequence = Math.max(transportSequence, normalized.sequence);
        if (!normalized.event) return;
        onEvent(normalized.event);
        if (isTerminalEvent(normalized.event)) {
          terminal = true;
          streamController.abort();
        }
      });
    } catch (error) {
      if (outerSignal.aborted) throw error;
      if (!terminal && error instanceof AIApiError && error.status === 401) throw error;
      if (!terminal && !(error instanceof DOMException && error.name === 'AbortError')) {
        // The Run snapshot below decides whether another replay attempt is needed.
      }
    } finally {
      outerSignal.removeEventListener('abort', abortStream);
    }
    if (terminal) break;
    const snapshot = await getAIRun(threadId, run.id);
    if (TERMINAL_STATUSES.has(snapshot.status)) return { run: snapshot, transportSequence };
    retriesWithoutProgress = transportSequence > beforeAttempt ? 0 : retriesWithoutProgress + 1;
  }

  return { run: await getAIRun(threadId, run.id), transportSequence };
}
