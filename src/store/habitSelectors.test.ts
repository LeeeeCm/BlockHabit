import { describe, it, expect, beforeEach } from 'vitest'
import { selectHabitCheckInSlice, clearHabitSliceCache } from './habitSelectors'
import type { CheckIn, Habit } from '../types'

describe('selectHabitCheckInSlice', () => {
  const habit1: Habit = {
    id: 'h1',
    name: '晨跑',
    frequency: { type: 'daily' },
    createdAt: '2026-09-01T00:00:00.000Z',
  }

  const habit2: Habit = {
    id: 'h2',
    name: '喝水',
    kind: 'counter',
    targetValue: 2000,
    step: 250,
    frequency: { type: 'daily' },
    createdAt: '2026-09-01T00:00:00.000Z',
  }

  const day = '2026-09-30'

  beforeEach(() => {
    clearHabitSliceCache()
  })

  it('computes initial slice for habit on given day', () => {
    const checkIns: CheckIn[] = [
      { id: 'c1', habitId: 'h1', date: day, at: '2026-09-30T08:00:00.000Z' },
    ]
    const slice = selectHabitCheckInSlice(checkIns, habit1, day)
    expect(slice.todayCheckIns.length).toBe(1)
    expect(slice.todayCheckIn?.id).toBe('c1')
    expect(slice.counterVal).toBe(0)
  })

  it('returns identical object reference when check-ins of another habit change', () => {
    const checkInsInitial: CheckIn[] = [
      { id: 'c1', habitId: 'h1', date: day, at: '2026-09-30T08:00:00.000Z' },
    ]
    const slice1 = selectHabitCheckInSlice(checkInsInitial, habit1, day)

    // Another habit h2 checks in (new array reference in store)
    const checkInsAfterH2CheckIn: CheckIn[] = [
      ...checkInsInitial,
      { id: 'c2', habitId: 'h2', date: day, at: '2026-09-30T09:00:00.000Z', value: 250 },
    ]
    const slice2 = selectHabitCheckInSlice(checkInsAfterH2CheckIn, habit1, day)

    // Strict reference equality Object.is check: MUST BE EXACT SAME REFERENCE
    expect(slice2).toBe(slice1)
  })

  it('returns new object reference when this habit check-ins change', () => {
    const checkInsInitial: CheckIn[] = [
      { id: 'c1', habitId: 'h1', date: day, at: '2026-09-30T08:00:00.000Z' },
    ]
    const slice1 = selectHabitCheckInSlice(checkInsInitial, habit1, day)

    // h1 checks in again
    const checkInsAfterH1CheckIn: CheckIn[] = [
      ...checkInsInitial,
      { id: 'c1_2', habitId: 'h1', date: day, at: '2026-09-30T10:00:00.000Z' },
    ]
    const slice2 = selectHabitCheckInSlice(checkInsAfterH1CheckIn, habit1, day)

    expect(slice2).not.toBe(slice1)
    expect(slice2.todayCheckIns.length).toBe(2)
  })

  it('returns new object reference when note, mood, or star of this habit updates', () => {
    const checkInsInitial: CheckIn[] = [
      { id: 'c1', habitId: 'h1', date: day, at: '2026-09-30T08:00:00.000Z', note: '初步感受' },
    ]
    const slice1 = selectHabitCheckInSlice(checkInsInitial, habit1, day)

    const checkInsUpdated: CheckIn[] = [
      { id: 'c1', habitId: 'h1', date: day, at: '2026-09-30T08:00:00.000Z', note: '深入反思', starred: true },
    ]
    const slice2 = selectHabitCheckInSlice(checkInsUpdated, habit1, day)

    expect(slice2).not.toBe(slice1)
    expect(slice2.todayCheckIn?.note).toBe('深入反思')
    expect(slice2.todayCheckIn?.starred).toBe(true)
  })

  it('computes counterVal correctly for counter habits', () => {
    const checkIns: CheckIn[] = [
      { id: 'c2_1', habitId: 'h2', date: day, at: '2026-09-30T08:00:00.000Z', value: 250 },
      { id: 'c2_2', habitId: 'h2', date: day, at: '2026-09-30T10:00:00.000Z', value: 500 },
    ]
    const slice = selectHabitCheckInSlice(checkIns, habit2, day)
    expect(slice.counterVal).toBe(750)
  })
})
