import { describe, expect, it } from 'vitest'
import type { Habit } from '../../types'
import { isQuotaOnlyDone, weekMissed } from './helpers'

const weekly: Habit = {
  id: 'h1',
  name: '健身',
  frequency: { type: 'weekly', times: 3 },
  createdAt: '2026-08-01T00:00:00.000Z'
}

describe('isQuotaOnlyDone', () => {
  it('周配额已满且今日未打卡 → true（完成态只来自周配额）', () => {
    expect(isQuotaOnlyDone(weekly, 3, 0)).toBe(true)
  })

  it('今日有打卡 → false（可正常撤销今天的记录）', () => {
    expect(isQuotaOnlyDone(weekly, 3, 1)).toBe(false)
  })

  it('周配额未满 → false', () => {
    expect(isQuotaOnlyDone(weekly, 2, 0)).toBe(false)
  })

  it('非周频 / 周频 counter → false', () => {
    expect(isQuotaOnlyDone({ ...weekly, frequency: { type: 'daily' } }, 3, 0)).toBe(false)
    expect(isQuotaOnlyDone({ ...weekly, kind: 'counter' }, 3, 0)).toBe(false)
  })
})

describe('weekMissed', () => {
  it('周日还需 2 次 → 已无法达标', () => {
    // 2026-08-23 是周日，本周只剩 1 天
    expect(weekMissed(weekly, 1, '2026-08-23')).toBe(true)
  })

  it('周一还需 3 次 → 仍可达标', () => {
    // 2026-08-17 是周一，本周还有 7 天
    expect(weekMissed(weekly, 0, '2026-08-17')).toBe(false)
  })
})
