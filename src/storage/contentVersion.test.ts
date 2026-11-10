import { describe, expect, it } from 'vitest'
import { STATE_KEY, createLocalStorageAdapter, loadAndMigrate, normalizeState, prepareImport, sanitizeState } from './adapter'
import { serializeState } from '../store/serializeState'
import { mergeAppState } from '../sync/merge'
import { CONTENT_VERSION, isFutureContentVersion, normalizeContentVersion } from '../logic/blueprints/manifest'
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
    ...overrides,
  }
}

describe('contentVersion helpers', () => {
  it('missing/invalid versions normalize to current', () => {
    expect(normalizeContentVersion(undefined)).toBe(CONTENT_VERSION)
    expect(normalizeContentVersion('x')).toBe(CONTENT_VERSION)
    expect(normalizeContentVersion(0)).toBe(CONTENT_VERSION)
    expect(normalizeContentVersion(2)).toBe(2)
    expect(isFutureContentVersion(CONTENT_VERSION + 1)).toBe(true)
    expect(isFutureContentVersion(CONTENT_VERSION)).toBe(false)
  })
})

describe('内容版本门（B1 兼容矩阵）', () => {
  it('旧存档无 contentVersion：按 1 加载，保存后补写当前版本', () => {
    const loaded = loadAndMigrate(baseState())
    expect(loaded.state?.contentVersion).toBe(CONTENT_VERSION)
    const saved = serializeState(loaded.state!)
    expect(saved.contentVersion).toBe(CONTENT_VERSION)
  })

  it('旧客户端 × 新存档：needsUpgrade，sanitize 不执行、未知蓝图数据不被清洗落盘', () => {
    const future = {
      ...baseState(),
      contentVersion: CONTENT_VERSION + 1,
      builds: [{ id: 'b1', blueprintId: 'future-tower', index: 0, placedAt: '2026-11-10T00:00:00.000Z', fromHabitId: 'h1', bonus: false }],
      completedBlueprintIds: ['future-tower'],
      activeBlueprintId: 'future-tower',
    }
    const loaded = loadAndMigrate(future)
    expect(loaded.state).toBeNull()
    expect(loaded.state === null && loaded.needsUpgrade).toBe(true)
    // 本地加载路径不会走 sanitizeState；直接调用宽松清洗才会丢未知数据（门禁的意义）
    expect(sanitizeState(future)?.completedBlueprintIds).toEqual([])
  })

  it('导入/同步前置：更高内容版本返回 null，不覆盖本地', () => {
    const future = { ...baseState(), contentVersion: CONTENT_VERSION + 1 }
    expect(prepareImport(future)).toBeNull()
    expect(prepareImport(baseState())?.contentVersion).toBe(CONTENT_VERSION)
  })

  it('显式旧版本（contentVersion=1）读入后升为当前版本，保存写当前版本', () => {
    const loaded = loadAndMigrate({ ...baseState(), contentVersion: 1 })
    expect(loaded.state?.contentVersion).toBe(CONTENT_VERSION)
    expect(serializeState(loaded.state!).contentVersion).toBe(CONTENT_VERSION)
    expect(prepareImport({ ...baseState(), contentVersion: 1 })?.contentVersion).toBe(CONTENT_VERSION)
  })

  it('同版本存档正常加载且内容版本保留', () => {
    const loaded = loadAndMigrate({ ...baseState(), contentVersion: CONTENT_VERSION })
    expect(loaded.state?.contentVersion).toBe(CONTENT_VERSION)
    expect(normalizeState(baseState({ contentVersion: CONTENT_VERSION })).contentVersion).toBe(CONTENT_VERSION)
  })

  it('双端合并：contentVersion 取较高值，不因旧端写低', () => {
    const merged = mergeAppState(
      baseState({ contentVersion: CONTENT_VERSION }),
      baseState({ contentVersion: CONTENT_VERSION + 1 }),
    )
    expect(merged.contentVersion).toBe(CONTENT_VERSION + 1)
    const mergedOld = mergeAppState(baseState({ contentVersion: CONTENT_VERSION }), baseState())
    expect(mergedOld.contentVersion).toBe(CONTENT_VERSION)
    // 双端都是显式旧版本时也不能把合并结果写低（真实路径已被 normalize，这里防御 API 误用）
    const bothOld = mergeAppState(baseState({ contentVersion: 1 }), baseState({ contentVersion: 1 }))
    expect(bothOld.contentVersion).toBe(CONTENT_VERSION)
  })

  it('本地存储未来内容版本：needsUpgrade 且原始存档字节不被改写', async () => {
    const future = JSON.stringify({ ...baseState(), contentVersion: CONTENT_VERSION + 1 })
    localStorage.setItem(STATE_KEY, future)
    const res = await createLocalStorageAdapter().load()
    expect(res.state).toBeNull()
    expect(res.needsUpgrade).toBe(true)
    expect(localStorage.getItem(STATE_KEY)).toBe(future)
    localStorage.removeItem(STATE_KEY)
  })
})
