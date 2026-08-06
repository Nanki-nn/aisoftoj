import { describe, expect, it } from 'vitest'
import { formatRecordTime, historyProgress, importanceLabel } from './model'

describe('learning record model', () => {
  it('formats backend timestamps without depending on device locale', () => {
    expect(formatRecordTime('2026-08-06 09:12:30')).toBe('2026-08-06 09:12')
    expect(formatRecordTime('2026-08-06T09:12:30')).toBe('2026-08-06 09:12')
  })

  it('clamps answered progress to the paper total', () => {
    expect(historyProgress({ answeredCount: 80, totalCount: 75 } as never)).toBe('75 / 75 题')
  })

  it('uses student-facing importance labels', () => {
    expect(importanceLabel('must')).toBe('必看')
    expect(importanceLabel('medium')).toBe('重点')
  })
})
