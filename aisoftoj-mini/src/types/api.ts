export interface ApiResult<T> {
  code: number
  message: string
  data: T
  timestamp: number
}

export interface AuthUser {
  id: string
  username?: string
  email?: string | null
  emailVerified?: boolean
  nickname?: string
  avatar?: string | null
  role: string
  totalExams?: number
  totalQuestions?: number
  accuracy?: number
  studyDays?: number
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export interface PaperDTO {
  id: number
  name?: string
  subjectName?: string
  paperCateId: number
  paperYear?: number
  paperMonth?: number
  questionTotal: number
  readCt?: number
  completedCount?: number
  doingSessionId?: number | null
  paperStatus?: 'not_started' | 'in_progress' | 'completed'
  updateTime?: string
}

export interface PaperSummary {
  id: string
  title: string
  subject: string
  category: '综合知识' | '案例分析' | '论文'
  dateLabel: string
  questionCount: number
  completedCount: number
  sessionId: string | null
  status: 'not_started' | 'in_progress' | 'completed'
}

export interface QuestionOptionDTO {
  keyStr: string
  valueStr: string
  orderNum?: number
}

export interface QuestionDTO {
  id: number
  name?: string
  intro: string
  options?: QuestionOptionDTO[]
  answer?: string
  analysis?: string
  questionType: number
  difficulty?: number
  questionRecordId: number
  userAnswer?: string | null
  isSubmitted?: boolean
  isCorrect?: boolean | null
  spendTime?: number
  answerRevision: number
  questionOrder?: number
  scoreSnapshot?: number
  gradingStrategySnapshot?: string
  confirmedAt?: string | null
}

export interface PracticeSessionDTO {
  id?: number
  practiceSessionId?: number
  paperId: number
  paperName: string
  examMode?: 'practice' | 'exam'
  status: number
  startTime: string
  endTime?: string | null
  questionList: QuestionDTO[]
}
