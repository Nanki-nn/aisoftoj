import { describe, expect, it } from 'vitest'
import type { StoragePort } from '../../adapters/storage'
import { applyDrafts, clearRecovery, completeAnswer, loadRecovery, queueAnswer, retryDelay, saveDraft } from './recovery'

function memoryStorage(): StoragePort {
  const values = new Map<string, string>()
  return { get: (key) => values.get(key), set: (key, value) => { values.set(key, value) }, remove: (key) => { values.delete(key) } }
}

describe('session recovery', () => {
  it('stores only answer drafts and overlays them onto an unconfirmed encrypted session', () => {
    const storage = memoryStorage()
    saveDraft(storage, '8', 3, 'local answer')
    const session = applyDrafts(storage, '8', {
      paperId: 1, paperName: 'paper', status: 0, startTime: '',
      questionList: [{ id: 3, intro: 'secret question', questionType: 2, questionRecordId: 9, answerRevision: 0 }]
    })
    expect(session.questionList[0].userAnswer).toBe('local answer')
    expect(JSON.stringify(loadRecovery(storage, '8'))).not.toContain('secret question')
  })

  it('keeps a stable mutation pending until the server acknowledges it', () => {
    const storage = memoryStorage()
    saveDraft(storage, '8', 3, 'A')
    queueAnswer(storage, '8', { recordId: 9, questionId: 3, userAnswer: 'A', spendTime: 0, expectedRevision: 0, mutationId: 'stable', confirm: false, attempt: 0 })
    expect(loadRecovery(storage, '8').pending[0].mutationId).toBe('stable')
    completeAnswer(storage, '8', 9, 3)
    expect(loadRecovery(storage, '8')).toEqual({ drafts: {}, pending: [] })
    saveDraft(storage, '8', 3, 'new')
    clearRecovery(storage, '8')
    expect(loadRecovery(storage, '8')).toEqual({ drafts: {}, pending: [] })
  })

  it('uses bounded exponential backoff', () => {
    expect([1, 2, 3, 10].map(retryDelay)).toEqual([1000, 2000, 4000, 30000])
  })
})
