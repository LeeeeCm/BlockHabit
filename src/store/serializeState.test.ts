import { describe, expect, it } from 'vitest'
import { serializeState } from './serializeState'
import type { AppState } from '../types'

function baseState(): AppState {
  return {
    schemaVersion: 2,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' },
    dayClaims: [],
    deletedDayClaims: [{ date: '2026-11-01', deletedAt: '2026-11-02T00:00:00.000Z' }],
    repairBricks: 3,
    repairBrickMonth: '2026-11',
    showcasePlacements: [{ blueprintId: 'plant', gridX: 1, gridY: 1 }],
    foundationNotes: { plant: 'hello' },
    reminderLog: { h1: { date: '2026-11-10', action: 'skipped' } }
  }
}

describe('serializeState', () => {
  it('keeps every persisted field, including repairBrickMonth', () => {
    const out = serializeState(baseState())
    expect(out.repairBrickMonth).toBe('2026-11')
    expect(out.repairBricks).toBe(3)
    expect(out.deletedDayClaims).toHaveLength(1)
    expect(out.foundationNotes).toEqual({ plant: 'hello' })
    expect(out.reminderLog).toEqual({ h1: { date: '2026-11-10', action: 'skipped' } })
  })

  it('does not leak runtime-only fields', () => {
    const state = baseState() as AppState & { hydrated?: boolean; saveError?: string }
    state.hydrated = true
    state.saveError = 'boom'
    const out = serializeState(state) as unknown as Record<string, unknown>
    expect('hydrated' in out).toBe(false)
    expect('saveError' in out).toBe(false)
  })
})
