import { describe, expect, it } from 'vitest'
import { normalizeState } from './adapter'
import type { AppState } from '../types'

function minimal(settings: Record<string, unknown>): AppState {
  return { settings } as unknown as AppState
}

describe('normalizeState evening nudge defaults', () => {
  it('defaults to disabled at 21:00 for old saves without the fields', () => {
    const next = normalizeState(minimal({ theme: 'light', language: 'zh' }))
    expect(next.settings.eveningNudgeEnabled).toBe(false)
    expect(next.settings.eveningNudgeTime).toBe('21:00')
  })

  it('keeps a valid enabled choice', () => {
    const next = normalizeState(minimal({ eveningNudgeEnabled: true, eveningNudgeTime: '20:30' }))
    expect(next.settings.eveningNudgeEnabled).toBe(true)
    expect(next.settings.eveningNudgeTime).toBe('20:30')
  })

  it('rejects invalid time strings', () => {
    const next = normalizeState(minimal({ eveningNudgeTime: '9:5' }))
    expect(next.settings.eveningNudgeTime).toBe('21:00')
  })
})
