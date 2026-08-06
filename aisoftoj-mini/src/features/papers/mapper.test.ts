import { describe, expect, it } from 'vitest'
import { mapPaper } from './mapper'

describe('paper mapper', () => {
  it('maps backend catalog fields into the student paper row', () => {
    expect(mapPaper({
      id: 3,
      name: '2025 年下半年系统架构设计师综合知识',
      subjectName: '系统架构设计师',
      paperCateId: 1,
      paperYear: 2025,
      paperMonth: 11,
      questionTotal: 75,
      completedCount: 18,
      doingSessionId: 12,
      paperStatus: 'in_progress'
    })).toEqual({
      id: '3',
      title: '2025 年下半年系统架构设计师综合知识',
      subject: '系统架构设计师',
      category: '综合知识',
      dateLabel: '2025.11',
      questionCount: 75,
      completedCount: 18,
      sessionId: '12',
      status: 'in_progress'
    })
  })
})
