import type {
  PracticeSessionDTO,
  QuestionDTO,
  QuestionRecordUpdateResponse,
  SubmitAnswerDTO
} from '../../types/api'

export function getSessionId(session: PracticeSessionDTO): string {
  const id = session.id ?? session.practiceSessionId
  if (!id) throw new Error('刷题会话标识缺失')
  return String(id)
}

export function updateQuestionAnswer(
  session: PracticeSessionDTO,
  questionId: number,
  answer: string
): PracticeSessionDTO {
  return {
    ...session,
    questionList: session.questionList.map((question) => (
      question.id === questionId ? { ...question, userAnswer: answer } : question
    ))
  }
}

export function applyServerQuestion(
  session: PracticeSessionDTO,
  questionId: number,
  server: QuestionRecordUpdateResponse
): PracticeSessionDTO {
  return {
    ...session,
    questionList: session.questionList.map((question) => (
      question.id === questionId
        ? {
            ...question,
            userAnswer: server.userAnswer,
            spendTime: server.spendTime,
            answerRevision: server.answerRevision,
            isSubmitted: server.isSubmitted,
            isCorrect: server.isCorrect,
            confirmedAt: server.confirmedAt
          }
        : question
    ))
  }
}

export function toSubmitAnswers(questions: QuestionDTO[]): SubmitAnswerDTO[] {
  return questions.map((question) => ({
    questionId: question.id,
    userAnswer: question.userAnswer?.trim() || null,
    spendTime: question.spendTime || 0
  }))
}

export function answeredCount(questions: QuestionDTO[]): number {
  return questions.filter((question) => Boolean(question.userAnswer?.trim())).length
}

export function toPlainQuestionText(value: string | undefined): string {
  return (value || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim()
}

let mutationCounter = 0

export function createMutationId(recordId: number): string {
  mutationCounter = (mutationCounter + 1) % 1000000
  return `mini-${recordId}-${Date.now().toString(36)}-${mutationCounter.toString(36)}`
}

export function isQuestionRecordUpdateResponse(
  value: unknown
): value is QuestionRecordUpdateResponse {
  const record = value as Partial<QuestionRecordUpdateResponse> | null
  return Boolean(
    record &&
    typeof record.recordId === 'number' &&
    typeof record.answerRevision === 'number' &&
    (typeof record.userAnswer === 'string' || record.userAnswer === null)
  )
}
