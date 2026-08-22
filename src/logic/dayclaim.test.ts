import { describe, it, expect } from 'vitest'
import { canClaimDay } from './checkin'
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
