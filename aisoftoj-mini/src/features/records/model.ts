import type { PracticeHistoryDTO, WrongQuestionDTO } from '../../types/api'

export function formatRecordTime(value: string): string {
  if (!value) return '时间待同步'
  return value.slice(0, 16).replace('T', ' ')
}

export function historyProgress(record: PracticeHistoryDTO): string {
  const answered = Math.max(0, record.answeredCount || 0)
  const total = Math.max(0, record.totalCount || 0)
  return `${Math.min(answered, total)} / ${total} 题`
}

export function importanceLabel(value: WrongQuestionDTO['importance']): string {
  return ({ low: '一般', medium: '重点', high: '高频', must: '必看' })[value] || '待复盘'
}
