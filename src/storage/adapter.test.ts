import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createLocalStorageAdapter,
  validateState,
  sanitizeState,
  loadAndMigrate,
  prepareImport,
  STATE_KEY,
  CORRUPT_BACKUP_KEY,
  SCHEMA_VERSION
} from './adapter'
import type { AppState } from '../types'

function emptyState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'castle',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' },
    dayClaims: []
  }
}

function validState(): AppState {
  const s = emptyState()
  s.habits.push({
    id: 'h1',
    name: '读书',
    frequency: { type: 'daily' },
    createdAt: '2026-08-22T10:00:00.000Z'
  })
  s.checkIns.push({ id: 'c1', habitId: 'h1', date: '2026-08-22', at: '2026-08-22T10:30:00.000Z' })
  s.builds.push({
    id: 'b1',
    blueprintId: 'castle',
    index: 0,
    placedAt: '2026-08-22T10:30:00.000Z',
    fromHabitId: 'h1',
    bonus: false
  })
  return s
}

describe('localStorage adapter', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when nothing stored', async () => {
    const a = createLocalStorageAdapter()
    expect((await a.load()).state).toBeNull()
  })

  it('roundtrips state', async () => {
    const a = createLocalStorageAdapter()
    await a.save(validState())
    const loaded = (await a.load()).state
    expect(loaded).not.toBeNull()
    expect(loaded!.habits[0].name).toBe('读书')
    expect(loaded!.activeBlueprintId).toBe('castle')
  })

  it('returns null on corrupt json and backs up raw content', async () => {
    localStorage.setItem(STATE_KEY, '{oops')
    const a = createLocalStorageAdapter()
    expect((await a.load()).state).toBeNull()
    const backup = localStorage.getItem(CORRUPT_BACKUP_KEY)
    expect(backup).not.toBeNull()
    expect(JSON.parse(backup!).raw).toBe('{oops')
  })

  it('returns null on wrong schemaVersion without marking corrupt', async () => {
    const s = { ...emptyState(), schemaVersion: 99 } as unknown as AppState
    localStorage.setItem(STATE_KEY, JSON.stringify(s))
    const a = createLocalStorageAdapter()
    const res = await a.load()
    expect(res.state).toBeNull()
    expect(res.needsUpgrade).toBe(true)
    // 来自未来版本的合法存档：不是损坏，不应写损坏备份
    expect(localStorage.getItem(CORRUPT_BACKUP_KEY)).toBeNull()
  })

  it('save rejects on quota errors (no silent swallowing)', async () => {
    const a = createLocalStorageAdapter()
    const failing = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    await expect(a.save(emptyState())).rejects.toThrow()
    failing.mockRestore()
  })

  it('backup stores latest state under BACKUP key', async () => {
    const a = createLocalStorageAdapter()
    await a.backup!(validState())
    expect(localStorage.getItem('blockhabit-backup-latest')).not.toBeNull()
  })
})

describe('validateState (strict, for import/sync)', () => {
  it('accepts a fully valid state', () => {
    const r = validateState(validState())
    expect(r.ok).toBe(true)
  })

  it('rejects non-object / missing top-level fields', () => {
    expect(validateState(null).ok).toBe(false)
    expect(validateState('x').ok).toBe(false)
    expect(validateState({ ...emptyState(), habits: 'nope' }).ok).toBe(false)
    expect(validateState({ ...emptyState(), activeBlueprintId: '' }).ok).toBe(false)
    expect(validateState({ ...emptyState(), settings: null }).ok).toBe(false)
  })

  it('rejects habit with malformed frequency', () => {
    const s = validState()
    ;(s.habits[0] as unknown as { frequency: unknown }).frequency = 'daily'
    expect(validateState(s).ok).toBe(false)
  })

  it('rejects habit with weekly times <= 0 / custom days out of range', () => {
    const bad1 = validState()
    bad1.habits[0] = { ...bad1.habits[0], frequency: { type: 'weekly', times: 0 } }
    expect(validateState(bad1).ok).toBe(false)
    const bad2 = validState()
    bad2.habits[0] = { ...bad2.habits[0], frequency: { type: 'custom', days: [0, 9] } }
    expect(validateState(bad2).ok).toBe(false)
  })

  it('rejects checkIns containing null or bad date', () => {
    const s1 = validState()
    ;(s1.checkIns as unknown[])[0] = null
    expect(validateState(s1).ok).toBe(false)
    const s2 = validState()
    s2.checkIns[0] = { ...s2.checkIns[0], date: '2026/08/22' }
    expect(validateState(s2).ok).toBe(false)
  })

  it('rejects builds missing blueprintId or negative index', () => {
    const s1 = validState()
    delete (s1.builds[0] as unknown as Record<string, unknown>).blueprintId
    expect(validateState(s1).ok).toBe(false)
    const s2 = validState()
    s2.builds[0] = { ...s2.builds[0], index: -1 }
    expect(validateState(s2).ok).toBe(false)
  })

  it('rejects future schema versions', () => {
    const s = { ...validState(), schemaVersion: SCHEMA_VERSION + 1 }
    expect(validateState(s).ok).toBe(false)
  })
})

describe('sanitizeState (lenient, for local load)', () => {
  it('drops invalid elements and keeps valid ones', () => {
    const s = validState()
    ;(s.checkIns as unknown[]).push(null)
    s.builds.push({ id: 'bad' } as unknown as AppState['builds'][number])
    const cleaned = sanitizeState(s)
    expect(cleaned).not.toBeNull()
    expect(cleaned!.habits).toHaveLength(1)
    expect(cleaned!.checkIns).toHaveLength(1)
    expect(cleaned!.builds).toHaveLength(1)
  })

  it('returns null when top-level structure is broken', () => {
    expect(sanitizeState(null)).toBeNull()
    expect(sanitizeState({ ...emptyState(), settings: 'x' })).toBeNull()
  })

  it('coerces invalid settings fields via normalizeState (theme fallback)', () => {
    const s = validState()
    ;(s.settings as unknown as Record<string, unknown>).theme = 'neon'
    const cleaned = sanitizeState(s)
    expect(cleaned).not.toBeNull()
    expect(cleaned!.settings.theme).toBe('light')
  })
})

describe('v1 → v2 migration', () => {
  function v1State() {
    return {
      schemaVersion: 1,
      habits: [
        {
          id: 'h1',
          name: '读书',
          frequency: { type: 'daily' },
          createdAt: '2026-08-01T00:00:00.000Z'
        }
      ],
      checkIns: [
        // v1 遗留：带 rewardBlockIndex、无 blueprintId
        {
          id: 'c1',
          habitId: 'h1',
          date: '2026-08-10',
          at: '2026-08-10T09:00:00.000Z',
          placedBlockId: 'b1',
          rewardBlockIndex: 0
        }
      ],
      builds: [
        {
          id: 'b1',
          blueprintId: 'castle',
          index: 0,
          placedAt: '2026-08-10T09:00:00.000Z',
          fromHabitId: 'h1',
          bonus: false
        },
        {
          id: 'day1',
          blueprintId: 'castle',
          index: 1,
          placedAt: '2026-08-10T20:00:00.000Z',
          fromHabitId: '__day__',
          bonus: true
        }
      ],
      activeBlueprintId: 'castle',
      completedBlueprintIds: [],
      settings: { theme: 'light', language: 'zh' },
      dayClaims: ['2026-08-10']
    }
  }

  it('upgrades dayClaims to DayClaim[] with backfilled blockId/blueprintId', () => {
    const r = loadAndMigrate(v1State())
    expect(r.state).not.toBeNull()
    if (!r.state) return
    expect(r.state.schemaVersion).toBe(SCHEMA_VERSION)
    expect(r.state.dayClaims).toEqual([
      {
        date: '2026-08-10',
        claimedAt: '2026-08-10T12:00:00.000Z',
        blockId: 'day1',
        blueprintId: 'castle'
      }
    ])
    expect(r.state.deletedDayClaims).toEqual([])
  })

  it('backfills checkIn.blueprintId from placed blocks and drops rewardBlockIndex', () => {
    const r = loadAndMigrate(v1State())
    expect(r.state).not.toBeNull()
    if (!r.state) return
    const c1 = r.state.checkIns[0]
    expect(c1.blueprintId).toBe('castle')
    expect('rewardBlockIndex' in c1).toBe(false)
  })

  it('imports legacy v1 exports through prepareImport', () => {
    const prepared = prepareImport(v1State())
    expect(prepared).not.toBeNull()
    expect(prepared!.schemaVersion).toBe(SCHEMA_VERSION)
    expect(prepared!.dayClaims[0].blockId).toBe('day1')
  })

  it('migrates v1 archives with empty dayClaims (prepareImport must not skip via v2 fast path)', () => {
    const s = { ...v1State(), dayClaims: [] }
    const prepared = prepareImport(s)
    expect(prepared).not.toBeNull()
    expect(prepared!.schemaVersion).toBe(SCHEMA_VERSION)
    // 迁移必须生效：checkIn.blueprintId 已回填（否则合并重建会丢块）
    expect(prepared!.checkIns[0].blueprintId).toBe('castle')
    expect(prepared!.deletedDayClaims).toEqual([])
  })

  it('rejects malformed v1 archives after migration attempt', () => {
    const bad = v1State() as Record<string, unknown>
    bad.habits = [{ id: '', name: 'no-name', frequency: { type: 'daily' }, createdAt: 'x' }]
    expect(prepareImport(bad)).toBeNull()
  })
})

describe('loadAndMigrate (current version)', () => {
  it('migrates current-version state through validate+normalize', () => {
    const r = loadAndMigrate(validState())
    expect('state' in r).toBe(true)
    if (!('state' in r) || r.state === null) throw new Error('expected migrated state')
    // normalizeState 补齐所有设置字段
    expect(r.state.settings.enableAmbientLighting).toBe(true)
    expect(r.state.settings.soundMuted).toBe(false)
  })

  it('flags needsUpgrade for future versions', () => {
    const s = { ...validState(), schemaVersion: SCHEMA_VERSION + 3 }
    const r = loadAndMigrate(s)
    expect(r.state).toBeNull()
    expect('needsUpgrade' in r && r.needsUpgrade).toBe(true)
  })
})
