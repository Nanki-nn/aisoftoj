import type { StoragePort } from '../../adapters/storage'
import type { PracticeSessionDTO, QuestionRecordUpdateRequest } from '../../types/api'

const KEY_PREFIX = 'aisoftoj.mini.session-recovery.'

export interface PendingAnswer extends QuestionRecordUpdateRequest {
  recordId: number
  questionId: number
  attempt: number
}

interface SessionRecoveryState {
  drafts: Record<string, string>
  pending: PendingAnswer[]
}

function emptyState(): SessionRecoveryState {
  return { drafts: {}, pending: [] }
}

function key(sessionId: string): string {
  return `${KEY_PREFIX}${sessionId}`
}

export function loadRecovery(storage: StoragePort, sessionId: string): SessionRecoveryState {
  try {
    const value = JSON.parse(storage.get(key(sessionId)) || '') as Partial<SessionRecoveryState>
    return {
      drafts: value.drafts && typeof value.drafts === 'object' ? value.drafts : {},
      pending: Array.isArray(value.pending) ? value.pending : []
    }
  } catch {
    return emptyState()
  }
}

function saveRecovery(storage: StoragePort, sessionId: string, state: SessionRecoveryState): void {
  if (!Object.keys(state.drafts).length && !state.pending.length) {
    storage.remove(key(sessionId))
    return
  }
  storage.set(key(sessionId), JSON.stringify(state))
}

export function saveDraft(storage: StoragePort, sessionId: string, questionId: number, answer: string): void {
  const state = loadRecovery(storage, sessionId)
  state.drafts[String(questionId)] = answer
  saveRecovery(storage, sessionId, state)
}

export function applyDrafts(storage: StoragePort, sessionId: string, session: PracticeSessionDTO): PracticeSessionDTO {
  const drafts = loadRecovery(storage, sessionId).drafts
  return {
    ...session,
    questionList: session.questionList.map((question) => (
      question.confirmedAt || drafts[String(question.id)] == null
        ? question
        : { ...question, userAnswer: drafts[String(question.id)] }
    ))
  }
}

export function queueAnswer(storage: StoragePort, sessionId: string, answer: PendingAnswer): void {
  const state = loadRecovery(storage, sessionId)
  state.pending = state.pending.filter((item) => item.recordId !== answer.recordId)
  state.pending.push(answer)
  saveRecovery(storage, sessionId, state)
}

export function completeAnswer(storage: StoragePort, sessionId: string, recordId: number, questionId: number): void {
  const state = loadRecovery(storage, sessionId)
  state.pending = state.pending.filter((item) => item.recordId !== recordId)
  delete state.drafts[String(questionId)]
  saveRecovery(storage, sessionId, state)
}

export function recordSyncFailure(storage: StoragePort, sessionId: string, recordId: number): number {
  const state = loadRecovery(storage, sessionId)
  const item = state.pending.find((candidate) => candidate.recordId === recordId)
  if (!item) return 0
  item.attempt += 1
  saveRecovery(storage, sessionId, state)
  return item.attempt
}

export function retryDelay(attempt: number): number {
  return Math.min(30000, 1000 * (2 ** Math.max(0, attempt - 1)))
}

export function clearRecovery(storage: StoragePort, sessionId: string): void {
  storage.remove(key(sessionId))
}
