import { describe, it, expect, beforeEach } from 'vitest'
import { createLocalStorageAdapter, STATE_KEY, SCHEMA_VERSION } from './adapter'
import type { AppState } from '../types'

function emptyState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'castle',
    completedBlueprintIds: [],
    settings: { theme: 'light' },
  }
}

describe('localStorage adapter', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when nothing stored', async () => {
    const a = createLocalStorageAdapter()
    expect(await a.load()).toBeNull()
  })

  it('roundtrips state', async () => {
    const a = createLocalStorageAdapter()
    const s = emptyState()
    s.habits.push({
      id: 'h1',
      name: '读书',
      frequency: { type: 'daily' },
      createdAt: '2026-08-22T10:00:00.000Z',
    })
    await a.save(s)
    const loaded = await a.load()
    expect(loaded).not.toBeNull()
    expect(loaded!.habits[0].name).toBe('读书')
    expect(loaded!.activeBlueprintId).toBe('castle')
  })

  it('returns null on corrupt json', async () => {
    localStorage.setItem(STATE_KEY, '{oops')
    const a = createLocalStorageAdapter()
    expect(await a.load()).toBeNull()
  })

  it('returns null on wrong schemaVersion', async () => {
    const s = emptyState() as AppState & { schemaVersion: number }
    s.schemaVersion = 99
    localStorage.setItem(STATE_KEY, JSON.stringify(s))
    const a = createLocalStorageAdapter()
    expect(await a.load()).toBeNull()
  })
})
