import { describe, it, expect } from 'vitest'
import { dayClaimStreak } from './streak'

describe('dayClaimStreak（连续每日打卡领块）', () => {
  it('counts consecutive claimed days ending today', () => {
    expect(dayClaimStreak(['2026-08-20', '2026-08-21', '2026-08-22'], new Date(2026, 7, 22))).toBe(3)
  })

  it('today unclaimed counts from yesterday', () => {
    expect(dayClaimStreak(['2026-08-20', '2026-08-21'], new Date(2026, 7, 22))).toBe(2)
  })

  it('gap resets', () => {
    expect(dayClaimStreak(['2026-08-19', '2026-08-21'], new Date(2026, 7, 22))).toBe(1)
  })

  it('empty → 0', () => {
    expect(dayClaimStreak([], new Date(2026, 7, 22))).toBe(0)
  })

  it('unordered input tolerated', () => {
    expect(dayClaimStreak(['2026-08-22', '2026-08-20', '2026-08-21'], new Date(2026, 7, 22))).toBe(3)
  })
})
