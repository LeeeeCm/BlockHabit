import { describe, it, expect } from 'vitest'
import { canClaimDay, dayCompletionRatio } from './checkin'
import type { Habit, CheckIn } from '../types'

const daily: Habit = {
  id: 'h1',
  name: '读书',
  frequency: { type: 'daily' },
  createdAt: '2026-08-01T00:00:00.000Z',
}
const weekly2: Habit = {
  id: 'h2',
  name: '健身',
  frequency: { type: 'weekly', times: 2 },
  createdAt: '2026-08-01T00:00:00.000Z',
}

function ci(habitId: string, date: string): CheckIn {
  return { id: `${habitId}-${date}`, habitId, date, at: `${date}T12:00:00.000Z` }
}

describe('canClaimDay（每日全任务完成才掉一块积木）', () => {
  it('no active habits → no-habits', () => {
    expect(canClaimDay([], [], [], '2026-08-22')).toEqual({ ok: false, reason: 'no-habits' })
  })

  it('not all habits done → incomplete', () => {
    const cs = [ci('h1', '2026-08-22')]
    expect(canClaimDay([daily, weekly2], cs, [], '2026-08-22')).toEqual({ ok: false, reason: 'incomplete' })
  })

  it('weekly habit met via week quota counts as done', () => {
    const cs = [
      ci('h1', '2026-08-22'),
      ci('h2', '2026-08-18'),
      ci('h2', '2026-08-19'),
    ]
    expect(canClaimDay([daily, weekly2], cs, [], '2026-08-22').ok).toBe(true)
  })

  it('all done → ok', () => {
    const daily2 = { ...daily, id: 'h3' }
    const cs = [ci('h1', '2026-08-22'), ci('h3', '2026-08-22')]
    expect(canClaimDay([daily, daily2], cs, [], '2026-08-22')).toEqual({ ok: true })
  })

  it('already claimed today → already', () => {
    const cs = [ci('h1', '2026-08-22')]
    expect(canClaimDay([daily], cs, ['2026-08-22'], '2026-08-22')).toEqual({ ok: false, reason: 'already' })
  })

  it('archived habits ignored', () => {
    const archived = { ...weekly2, archivedAt: '2026-08-20T00:00:00.000Z' }
    const cs = [ci('h1', '2026-08-22')]
    expect(canClaimDay([daily, archived], cs, [], '2026-08-22').ok).toBe(true)
  })
})

describe('dayCompletionRatio（归档/新建不回溯影响历史）', () => {
  it('habit archived later does not change historical ratio', () => {
    // A 创建于 8-1，8-21 归档；B 创建于 8-1 仍在册。8-15 当天 A 打卡 B 未打
    const a: Habit = { id: 'ha', name: 'A', frequency: { type: 'daily' }, createdAt: '2026-08-01T00:00:00', archivedAt: '2026-08-21T10:00:00' }
    const b: Habit = { id: 'hb', name: 'B', frequency: { type: 'daily' }, createdAt: '2026-08-01T00:00:00' }
    const cs = [ci('ha', '2026-08-15')]
    // 归档后回看 8-15：A 在当天在册（归档发生在之后）→ 仍计入 1/2
    expect(dayCompletionRatio([a, b], cs, '2026-08-15')).toBeCloseTo(0.5)
  })

  it('day after archive excludes the habit', () => {
    const a: Habit = { id: 'ha', name: 'A', frequency: { type: 'daily' }, createdAt: '2026-08-01T00:00:00', archivedAt: '2026-08-21T10:00:00' }
    const b: Habit = { id: 'hb', name: 'B', frequency: { type: 'daily' }, createdAt: '2026-08-01T00:00:00' }
    // 8-22：A 已归档不计 → 只有 B，B 打了卡 → 100%
    expect(dayCompletionRatio([a, b], [ci('hb', '2026-08-22')], '2026-08-22')).toBe(1)
  })

  it('day before habit creation has no data (-1)', () => {
    const b: Habit = { id: 'hb', name: 'B', frequency: { type: 'daily' }, createdAt: '2026-08-10T00:00:00' }
    expect(dayCompletionRatio([b], [], '2026-08-05')).toBe(-1)
  })

  it('all archived on that day → no data', () => {
    const a: Habit = { id: 'ha', name: 'A', frequency: { type: 'daily' }, createdAt: '2026-08-01T00:00:00', archivedAt: '2026-08-20T00:00:00' }
    expect(dayCompletionRatio([a], [], '2026-08-22')).toBe(-1)
  })
})
