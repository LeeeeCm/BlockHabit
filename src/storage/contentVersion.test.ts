import { describe, expect, it } from 'vitest'
import {
  STATE_KEY,
  createLocalStorageAdapter,
  loadAndMigrate,
  normalizeState,
  prepareImport,
  sanitizeState
} from './adapter'
import { serializeState } from '../store/serializeState'
import { mergeAppState } from '../sync/merge'
import {
  CONTENT_PACKS,
  CONTENT_PACK_V3_IDS,
  CONTENT_VERSION,
  isFutureContentVersion,
  normalizeContentVersion
} from '../logic/blueprints/manifest'
import type { AppState } from '../types'

function baseState(overrides: Partial<AppState> = {}): AppState {
  return {
    schemaVersion: 2,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' },
    dayClaims: [],
    ...overrides
  }
}

describe('内容版本 v3 与 manifest 一致性（D-20261111-070）', () => {
  it('当前内容版本 = 3，manifest 三包递增且 v3 追加 5 座', () => {
    expect(CONTENT_VERSION).toBe(3)
    expect(CONTENT_PACKS.map((pack) => pack.id)).toEqual(['base', 'city-life', 'city-life-2'])
    expect(CONTENT_PACKS.map((pack) => pack.version)).toEqual([1, 2, 3])
    expect(CONTENT_PACKS[2].version).toBe(3)
    expect(CONTENT_PACKS[2].blueprintIds).toEqual([...(CONTENT_PACK_V3_IDS as string[])])
    expect(CONTENT_PACK_V3_IDS).toHaveLength(5)
  })

  it('missing/invalid versions normalize to current', () => {
    expect(normalizeContentVersion(undefined)).toBe(CONTENT_VERSION)
    expect(normalizeContentVersion('x')).toBe(CONTENT_VERSION)
    expect(normalizeContentVersion(0)).toBe(CONTENT_VERSION)
    expect(normalizeContentVersion(2)).toBe(2)
    expect(normalizeContentVersion(3)).toBe(3)
    expect(isFutureContentVersion(CONTENT_VERSION + 1)).toBe(true)
    expect(isFutureContentVersion(4)).toBe(true)
    expect(isFutureContentVersion(3)).toBe(false)
    expect(isFutureContentVersion(CONTENT_VERSION)).toBe(false)
  })
})

describe('内容版本门（B1 兼容矩阵，v2 → v3）', () => {
  it('旧存档无 contentVersion：按 1 加载，保存后补写当前版本 3', () => {
    const loaded = loadAndMigrate(baseState())
    expect(loaded.state?.contentVersion).toBe(3)
    const saved = serializeState(loaded.state!)
    expect(saved.contentVersion).toBe(3)
  })

  it('旧 v2 档（显式 contentVersion=2）：正常读入并升到 3，保存写 3', () => {
    const loaded = loadAndMigrate({ ...baseState(), contentVersion: 2 })
    expect(loaded.state).not.toBeNull()
    expect(loaded.state?.contentVersion).toBe(3)
    expect(serializeState(loaded.state!).contentVersion).toBe(3)
    expect(prepareImport({ ...baseState(), contentVersion: 2 })?.contentVersion).toBe(3)
    expect(normalizeState(baseState({ contentVersion: 2 })).contentVersion).toBe(3)
  })

  it('旧客户端 × 新存档（v4）：needsUpgrade，sanitize 不执行、未知蓝图数据不被清洗落盘', () => {
    const future = {
      ...baseState(),
      contentVersion: 4,
      builds: [
        {
          id: 'b1',
          blueprintId: 'future-tower',
          index: 0,
          placedAt: '2026-11-10T00:00:00.000Z',
          fromHabitId: 'h1',
          bonus: false
        }
      ],
      completedBlueprintIds: ['future-tower'],
      activeBlueprintId: 'future-tower'
    }
    const loaded = loadAndMigrate(future)
    expect(loaded.state).toBeNull()
    expect(loaded.state === null && loaded.needsUpgrade).toBe(true)
    // 本地加载路径不会走 sanitizeState；直接调用宽松清洗才会丢未知数据（门禁的意义）
    expect(sanitizeState(future)?.completedBlueprintIds).toEqual([])
  })

  it('导入/同步前置：更高内容版本（v4）返回 null，不覆盖本地', () => {
    const future = { ...baseState(), contentVersion: 4 }
    expect(prepareImport(future)).toBeNull()
    expect(prepareImport(baseState())?.contentVersion).toBe(CONTENT_VERSION)
    expect(prepareImport({ ...baseState(), contentVersion: 2 })?.contentVersion).toBe(3)
  })

  it('显式旧版本（contentVersion=1）读入后升为当前版本，保存写当前版本', () => {
    const loaded = loadAndMigrate({ ...baseState(), contentVersion: 1 })
    expect(loaded.state?.contentVersion).toBe(CONTENT_VERSION)
    expect(serializeState(loaded.state!).contentVersion).toBe(CONTENT_VERSION)
    expect(prepareImport({ ...baseState(), contentVersion: 1 })?.contentVersion).toBe(
      CONTENT_VERSION
    )
  })

  it('同版本存档正常加载且内容版本保留', () => {
    const loaded = loadAndMigrate({ ...baseState(), contentVersion: CONTENT_VERSION })
    expect(loaded.state?.contentVersion).toBe(CONTENT_VERSION)
    expect(normalizeState(baseState({ contentVersion: CONTENT_VERSION })).contentVersion).toBe(
      CONTENT_VERSION
    )
  })

  it('双端合并：contentVersion 取较高值，不因旧端写低', () => {
    const merged = mergeAppState(baseState({ contentVersion: 3 }), baseState({ contentVersion: 4 }))
    expect(merged.contentVersion).toBe(4)
    const mergedOld = mergeAppState(baseState({ contentVersion: CONTENT_VERSION }), baseState())
    expect(mergedOld.contentVersion).toBe(CONTENT_VERSION)
    // 双端都是显式旧版本时也不能把合并结果写低（真实路径已被 normalize，这里防御 API 误用）
    const bothOld = mergeAppState(
      baseState({ contentVersion: 1 }),
      baseState({ contentVersion: 1 })
    )
    expect(bothOld.contentVersion).toBe(CONTENT_VERSION)
    // v3 客户端与 v2 客户端合并：取 3，不能回落到 2
    const v3WithV2 = mergeAppState(
      baseState({ contentVersion: 3 }),
      baseState({ contentVersion: 2 })
    )
    expect(v3WithV2.contentVersion).toBe(3)
  })

  it('本地存储未来内容版本（v4）：needsUpgrade 且原始存档字节不被改写', async () => {
    const future = JSON.stringify({ ...baseState(), contentVersion: 4 })
    localStorage.setItem(STATE_KEY, future)
    const res = await createLocalStorageAdapter().load()
    expect(res.state).toBeNull()
    expect(res.needsUpgrade).toBe(true)
    expect(localStorage.getItem(STATE_KEY)).toBe(future)
    localStorage.removeItem(STATE_KEY)
  })
})
