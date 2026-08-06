import type { PaperDTO, PaperSummary } from '../../types/api'

function mapCategory(categoryId: number): PaperSummary['category'] {
  if (categoryId === 2) return '案例分析'
  if (categoryId === 3) return '论文'
  return '综合知识'
}

export function mapPaper(dto: PaperDTO): PaperSummary {
  const month = dto.paperMonth ? String(dto.paperMonth).padStart(2, '0') : '--'
  return {
    id: String(dto.id),
    title: dto.name || `${dto.paperYear || '历年'}年软考试卷`,
    subject: dto.subjectName || '系统架构设计师',
    category: mapCategory(dto.paperCateId),
    dateLabel: `${dto.paperYear || '历年'}.${month}`,
    questionCount: dto.questionTotal || 0,
    completedCount: dto.completedCount || 0,
    sessionId: dto.doingSessionId ? String(dto.doingSessionId) : null,
    status: dto.paperStatus || 'not_started'
  }
}
