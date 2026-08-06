import { describe, expect, it } from 'vitest'
import type { PracticeSessionDTO } from '../../types/api'
import {
  answeredCount,
  applyServerQuestion,
  getSessionId,
  isQuestionRecordUpdateResponse,
  toPlainQuestionText,
  toSubmitAnswers,
  updateQuestionAnswer
} from './model'

const session: PracticeSessionDTO = {
  practiceSessionId: 12,
  paperId: 3,
  paperName: '架构师真题',
  status: 0,
  startTime: '2026-08-06T09:00:00Z',
  questionList: [{
    id: 7,
    intro: '<p>选择 &lt;正确&gt; 项<br>第二行</p>',
    questionType: 1,
    questionRecordId: 70,
    answerRevision: 0
  }]
}

describe('session model', () => {
  it('recovers the start-session identifier and prepares a full submission', () => {
    const answered = updateQuestionAnswer(session, 7, ' A ')
    expect(getSessionId(answered)).toBe('12')
    expect(answeredCount(answered.questionList)).toBe(1)
    expect(toSubmitAnswers(answered.questionList)).toEqual([
      { questionId: 7, userAnswer: 'A', spendTime: 0 }
    ])
  })

  it('applies the server revision after a save or conflict', () => {
    const next = applyServerQuestion(session, 7, {
      recordId: 70,
      userAnswer: 'B',
      spendTime: 8,
      answerRevision: 3,
      mutationId: 'server',
      isSubmitted: true,
      isCorrect: false,
      confirmedAt: null
    })
    expect(next.questionList[0]).toMatchObject({ userAnswer: 'B', answerRevision: 3 })
    expect(isQuestionRecordUpdateResponse({ recordId: 70, answerRevision: 3, userAnswer: 'B' }))
      .toBe(true)
  })

  it('renders question markup as inert readable text', () => {
    expect(toPlainQuestionText(session.questionList[0].intro))
      .toBe('选择 <正确> 项\n第二行')
  })
})
