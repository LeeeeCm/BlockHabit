import { describe, it, expect } from 'vitest'
import { mergeAppState } from './merge'
import type { AppState, CheckIn, Habit, PlacedBlock } from '../types'

function createMockState(overrides: Partial<AppState> = {}): AppState {
  return {
    schemaVersion: 1,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' },
    dayClaims: [],
    repairBricks: 0,
    showcasePlacements: [],
    foundationNotes: {},
    ...overrides,
  }
}

describe('mergeAppState CRDT union merge', () => {
  it('union merges checkIns from both devices by id or habitId+date, preserving all check-ins', () => {
    const checkIn1: CheckIn = {
      id: 'c1',
      habitId: 'h1',
      date: '2026-03-01',
      at: '2026-03-01T08:00:00.000Z',
      note: 'Morning run in park',
    }
    const checkIn2: CheckIn = {
      id: 'c2',
      habitId: 'h1',
      date: '2026-03-02',
      at: '2026-03-02T08:00:00.000Z',
    }
    const checkIn3: CheckIn = {
      id: 'c3',
      habitId: 'h2',
      date: '2026-03-01',
      at: '2026-03-01T10:00:00.000Z',
    }
    // Same ID as c1, with updated metadata from remote
    const checkIn1DuplicateId: CheckIn = {
      id: 'c1',
      habitId: 'h1',
      date: '2026-03-01',
      at: '2026-03-01T08:00:00.000Z',
      starred: true,
    }
    // Different ID but same habitId + date (offline checkin on second device)
    const checkIn1DuplicateDay: CheckIn = {
      id: 'c1-remote',
      habitId: 'h1',
      date: '2026-03-01',
      at: '2026-03-01T08:05:00.000Z',
      mood: 'energetic',
    }

    const local = createMockState({
      checkIns: [checkIn1, checkIn2],
    })
    const remote = createMockState({
      checkIns: [checkIn1DuplicateId, checkIn1DuplicateDay, checkIn3],
    })

    const merged = mergeAppState(local, remote)

    // Should preserve distinct check-ins (c1/2026-03-01, c2/2026-03-02, c3/2026-03-01)
    expect(merged.checkIns.length).toBe(3)

    // c1 merged should retain note, mood, and starred
    const mergedC1 = merged.checkIns.find((c) => c.habitId === 'h1' && c.date === '2026-03-01')
    expect(mergedC1).toBeDefined()
    expect(mergedC1?.note).toBe('Morning run in park')
    expect(mergedC1?.starred).toBe(true)
    expect(mergedC1?.mood).toBe('energetic')

    // c2 and c3 are preserved
    expect(merged.checkIns.some((c) => c.id === 'c2')).toBe(true)
    expect(merged.checkIns.some((c) => c.id === 'c3')).toBe(true)
  })

  it('merges habits: preserving existing habits and adding new habits from remote', () => {
    const habit1: Habit = {
      id: 'h1',
      name: 'Running',
      frequency: { type: 'daily' },
      createdAt: '2026-01-01T00:00:00.000Z',
      category: 'Sport',
    }
    const habit2Local: Habit = {
      id: 'h2',
      name: 'Reading',
      frequency: { type: 'daily' },
      createdAt: '2026-01-02T00:00:00.000Z',
      pinned: true,
    }
    const habit2Remote: Habit = {
      id: 'h2',
      name: 'Reading Books',
      frequency: { type: 'daily' },
      createdAt: '2026-01-02T00:00:00.000Z',
      archivedAt: '2026-02-01T00:00:00.000Z',
    }
    const habit3Remote: Habit = {
      id: 'h3',
      name: 'Meditation',
      frequency: { type: 'weekly', times: 3 },
      createdAt: '2026-02-01T00:00:00.000Z',
    }

    const local = createMockState({
      habits: [habit1, habit2Local],
    })
    const remote = createMockState({
      habits: [habit2Remote, habit3Remote],
    })

    const merged = mergeAppState(local, remote)

    expect(merged.habits.length).toBe(3)
    const h1 = merged.habits.find((h) => h.id === 'h1')
    const h2 = merged.habits.find((h) => h.id === 'h2')
    const h3 = merged.habits.find((h) => h.id === 'h3')

    expect(h1).toBeDefined()
    expect(h1?.name).toBe('Running')

    expect(h2).toBeDefined()
    // Preserves local pinned status and remote archived status
    expect(h2?.pinned).toBe(true)
    expect(h2?.archivedAt).toBe('2026-02-01T00:00:00.000Z')

    expect(h3).toBeDefined()
    expect(h3?.name).toBe('Meditation')
  })

  it('merges builds: union of placed blocks by ${blueprintId}_${index}', () => {
    const block0: PlacedBlock = {
      id: 'b0',
      blueprintId: 'tower',
      index: 0,
      placedAt: '2026-03-01T00:00:00.000Z',
      fromHabitId: 'h1',
      bonus: false,
    }
    const block1Local: PlacedBlock = {
      id: 'b1-local',
      blueprintId: 'tower',
      index: 1,
      placedAt: '2026-03-02T00:00:00.000Z',
      fromHabitId: 'h1',
      bonus: false,
    }
    const block1Remote: PlacedBlock = {
      id: 'b1-remote',
      blueprintId: 'tower',
      index: 1,
      placedAt: '2026-03-02T01:00:00.000Z',
      fromHabitId: 'h1',
      bonus: true,
    }
    const block2Remote: PlacedBlock = {
      id: 'b2',
      blueprintId: 'tower',
      index: 2,
      placedAt: '2026-03-03T00:00:00.000Z',
      fromHabitId: 'h2',
      bonus: false,
    }
    const blockCastle: PlacedBlock = {
      id: 'bc0',
      blueprintId: 'castle',
      index: 0,
      placedAt: '2026-03-01T00:00:00.000Z',
      fromHabitId: 'h1',
      bonus: false,
    }

    const local = createMockState({
      builds: [block0, block1Local],
    })
    const remote = createMockState({
      builds: [block1Remote, block2Remote, blockCastle],
    })

    const merged = mergeAppState(local, remote)

    // tower has index 0, 1, 2; castle has index 0 -> total 4 blocks
    expect(merged.builds.length).toBe(4)

    const towerBlocks = merged.builds.filter((b) => b.blueprintId === 'tower')
    expect(towerBlocks.length).toBe(3)
    const indices = towerBlocks.map((b) => b.index).sort((a, b) => a - b)
    expect(indices).toEqual([0, 1, 2])

    // Index 1 merged: if bonus was true on either, bonus is preserved
    const block1Merged = towerBlocks.find((b) => b.index === 1)
    expect(block1Merged?.bonus).toBe(true)

    const castleBlocks = merged.builds.filter((b) => b.blueprintId === 'castle')
    expect(castleBlocks.length).toBe(1)
    expect(castleBlocks[0].index).toBe(0)
  })

  it('union merges completedBlueprintIds and dayClaims', () => {
    const local = createMockState({
      completedBlueprintIds: ['plant', 'tower'],
      dayClaims: ['2026-03-01', '2026-03-03'],
    })
    const remote = createMockState({
      completedBlueprintIds: ['tower', 'castle'],
      dayClaims: ['2026-03-02', '2026-03-03'],
    })

    const merged = mergeAppState(local, remote)

    expect(merged.completedBlueprintIds.sort()).toEqual(['castle', 'plant', 'tower'])
    expect(merged.dayClaims).toEqual(['2026-03-01', '2026-03-02', '2026-03-03'])
  })

  it('merges repairBricks with math.max', () => {
    const local1 = createMockState({ repairBricks: 1 })
    const remote1 = createMockState({ repairBricks: 2 })
    expect(mergeAppState(local1, remote1).repairBricks).toBe(2)

    const local2 = createMockState({ repairBricks: 2 })
    const remote2 = createMockState({ repairBricks: 0 })
    expect(mergeAppState(local2, remote2).repairBricks).toBe(2)

    const local3 = createMockState({ repairBricks: undefined })
    const remote3 = createMockState({ repairBricks: 1 })
    expect(mergeAppState(local3, remote3).repairBricks).toBe(1)
  })

  it('merges foundationNotes and showcasePlacements', () => {
    const local = createMockState({
      foundationNotes: { plant: 'First plant note', tower: 'Tower local note' },
      showcasePlacements: [{ blueprintId: 'plant', gridX: 0, gridY: 0 }],
    })
    const remote = createMockState({
      foundationNotes: { tower: 'Tower remote note', castle: 'Castle note' },
      showcasePlacements: [
        { blueprintId: 'plant', gridX: 1, gridY: 1 },
        { blueprintId: 'castle', gridX: 2, gridY: 2 },
      ],
    })

    const merged = mergeAppState(local, remote)

    expect(merged.foundationNotes).toEqual({
      plant: 'First plant note',
      tower: 'Tower local note', // Local takes priority or combined
      castle: 'Castle note',
    })

    expect(merged.showcasePlacements?.length).toBe(2)
    const plantP = merged.showcasePlacements?.find((p) => p.blueprintId === 'plant')
    const castleP = merged.showcasePlacements?.find((p) => p.blueprintId === 'castle')
    expect(plantP?.gridX).toBe(0) // Local placement preserved
    expect(castleP?.gridX).toBe(2)
  })
})
