import { describe, expect, it } from 'vitest'
import { shouldEveningNudge, type EveningNudgeContext } from './eveningNudge'

const DAY = '2026-11-10'
const at = (h: number, m = 0) => new Date(2026, 10, 10, h, m, 0)

function ctx(over: Partial<EveningNudgeContext> = {}): EveningNudgeContext {
  return {
    now: at(21, 0),
    time: '21:00',
    enabled: true,
    remindersEnabled: true,
    pendingCount: 2,
    day: DAY,
    lastNudgedDay: null,
    ...over
  }
}

describe('shouldEveningNudge', () => {
  it('fires at the configured time with pending habits', () => {
    expect(shouldEveningNudge(ctx())).toMatchObject({ fire: true, reason: 'fire', pendingCount: 2 })
    expect(shouldEveningNudge(ctx({ now: at(21, 1) })).fire).toBe(true)
  })

  it('stays silent before the configured time', () => {
    expect(shouldEveningNudge(ctx({ now: at(20, 59) }))).toMatchObject({
      fire: false,
      reason: 'before-time'
    })
  })

  it('respects the global reminders switch', () => {
    expect(shouldEveningNudge(ctx({ remindersEnabled: false }))).toMatchObject({
      fire: false,
      reason: 'global-off'
    })
  })

  it('stays silent when disabled, invalid time, nothing pending, or already nudged today', () => {
    expect(shouldEveningNudge(ctx({ enabled: false }))).toMatchObject({
      fire: false,
      reason: 'disabled'
    })
    expect(shouldEveningNudge(ctx({ time: '25:99' }))).toMatchObject({
      fire: false,
      reason: 'invalid-time'
    })
    expect(shouldEveningNudge(ctx({ pendingCount: 0 }))).toMatchObject({
      fire: false,
      reason: 'nothing-pending'
    })
    expect(shouldEveningNudge(ctx({ lastNudgedDay: DAY }))).toMatchObject({
      fire: false,
      reason: 'already-nudged'
    })
  })

  it('nudges again on a new day', () => {
    expect(shouldEveningNudge(ctx({ lastNudgedDay: '2026-11-09' })).fire).toBe(true)
  })
})
