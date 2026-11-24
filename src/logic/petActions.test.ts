import { describe, expect, it } from 'vitest'
import type { CheckIn, Habit } from '../types'
import { petCheckInIntent, petPendingHabits, reminderIsCurrent } from './petActions'

const day = '2026-11-24'
const morning = new Date(2026, 10, 24, 9, 30)
const habit: Habit = {
  id: 'h',
  name: 'Read',
  createdAt: '2026-11-01T10:00:00.000Z',
  frequency: { type: 'daily' }
}
const check: CheckIn = { id: 'c', habitId: 'h', date: day, at: morning.toISOString() }

describe('pending pet actions', () => {
  it('lists a below-quota weekly habit but cannot record it twice today', () => {
    const weekly: Habit = { ...habit, frequency: { type: 'weekly', times: 3 } }
    expect(petPendingHabits([weekly], [check], day)).toEqual([{ habit: weekly, canRecord: false }])
    expect(petCheckInIntent(weekly, [check], day, day, morning.getTime())).toEqual({
      type: 'stale'
    })
  })

  it('omits archived habits, met habits, and custom days off', () => {
    const rest: Habit = { ...habit, id: 'rest', frequency: { type: 'custom', days: [1] } }
    const archived = { ...habit, id: 'archived', archivedAt: morning.toISOString() }
    expect(petPendingHabits([habit, rest, archived], [check], day)).toEqual([])
  })

  it('adds exactly one configured step until the target is reached', () => {
    const counter: Habit = { ...habit, kind: 'counter', targetValue: 10, step: 3 }
    expect(
      petCheckInIntent(counter, [{ ...check, value: 6 }], day, day, morning.getTime())
    ).toEqual({ type: 'record', delta: 3 })
    expect(
      petCheckInIntent(counter, [{ ...check, value: 10 }], day, day, morning.getTime())
    ).toEqual({ type: 'stale' })
  })

  it('refuses to write an action rendered before midnight', () => {
    expect(petCheckInIntent(habit, [], day, '2026-11-25', morning.getTime())).toEqual({
      type: 'stale'
    })
  })

  it('starts focus without recording and requires the same ready session at confirmation', () => {
    const focus: Habit = { ...habit, kind: 'focus', targetMinutes: 15 }
    const now = morning.getTime()
    const session = { startedAt: now - 17 * 60_000, targetMs: 15 * 60_000 }
    expect(petCheckInIntent(focus, [], day, day, now)).toEqual({ type: 'start', targetMs: 900_000 })
    expect(petCheckInIntent(focus, [], day, day, now, session)).toEqual({ type: 'show-focus' })
    expect(petCheckInIntent(focus, [], day, day, now, session, session)).toEqual({
      type: 'record',
      minutes: 17
    })
    expect(
      petCheckInIntent(focus, [], day, day, now, { ...session, extensions: 1 }, session)
    ).toEqual({ type: 'stale' })
  })
})

describe('reminder relevance', () => {
  const scheduled = { ...habit, reminder: { start: '09:00', end: '10:00' } }
  const item = {
    habitId: 'h',
    name: 'Read',
    start: '09:00',
    end: '10:00',
    stage: 'start' as const,
    firedAt: morning.getTime()
  }

  it('allows only live reminders inside their current window', () => {
    expect(reminderIsCurrent(item, scheduled, [], morning, true)).toBe(true)
    expect(reminderIsCurrent(item, scheduled, [], new Date(2026, 10, 24, 10), true)).toBe(false)
    expect(reminderIsCurrent(item, scheduled, [], new Date(2026, 10, 25, 9, 30), true)).toBe(false)
    expect(reminderIsCurrent(item, scheduled, [], morning, false)).toBe(false)
    expect(
      reminderIsCurrent(item, scheduled, [], morning, true, { date: day, action: 'skipped' })
    ).toBe(false)
    expect(
      reminderIsCurrent(item, { ...scheduled, reminder: { start: '09:15' } }, [], morning, true)
    ).toBe(false)
  })
})
