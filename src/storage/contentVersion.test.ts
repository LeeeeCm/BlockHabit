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

describe('内容版本 v6 与 manifest 一致性（D-20261128-131）', () => {
  it('当前内容版本 = 6，保留 v1/v2/v3/v6 四个建筑内容包', () => {
    expect(CONTENT_VERSION).toBe(6)
    expect(CONTENT_PACKS.map((pack) => pack.version)).toEqual([1, 2, 3, 6])
    expect(CONTENT_PACKS[2].version).toBe(3)
    expect(CONTENT_PACKS[2].blueprintIds).toEqual([...(CONTENT_PACK_V3_IDS as string[])])
    expect(CONTENT_PACK_V3_IDS).toHaveLength(5)
    expect(CONTENT_PACKS[3].id).toBe('city-life-3')
    expect(CONTENT_PACKS[3].blueprintIds).toHaveLength(12)
  })

  it('missing/invalid versions normalize to current', () => {
    expect(normalizeContentVersion(undefined)).toBe(CONTENT_VERSION)
    expect(normalizeContentVersion('x')).toBe(CONTENT_VERSION)
    expect(normalizeContentVersion(0)).toBe(CONTENT_VERSION)
    expect(normalizeContentVersion(2)).toBe(2)
    expect(normalizeContentVersion(3)).toBe(3)
    expect(normalizeContentVersion(4)).toBe(4)
    expect(isFutureContentVersion(CONTENT_VERSION + 1)).toBe(true)
    expect(isFutureContentVersion(7)).toBe(true)
    expect(isFutureContentVersion(6)).toBe(false)
    expect(isFutureContentVersion(4)).toBe(false)
    expect(isFutureContentVersion(3)).toBe(false)
    expect(isFutureContentVersion(CONTENT_VERSION)).toBe(false)
  })
})

describe('内容版本门（B1 兼容矩阵，v4 → v6）', () => {
  it('旧存档无 contentVersion：按 1 加载，保存后补写当前版本 6', () => {
    const loaded = loadAndMigrate(baseState())
    expect(loaded.state?.contentVersion).toBe(6)
    const saved = serializeState(loaded.state!)
    expect(saved.contentVersion).toBe(6)
  })

  it('旧 v3 档（显式 contentVersion=3）：正常读入并升到 6，保存写 6', () => {
    const loaded = loadAndMigrate({ ...baseState(), contentVersion: 3 })
    expect(loaded.state).not.toBeNull()
    expect(loaded.state?.contentVersion).toBe(6)
    expect(serializeState(loaded.state!).contentVersion).toBe(6)
    expect(prepareImport({ ...baseState(), contentVersion: 3 })?.contentVersion).toBe(6)
    expect(normalizeState(baseState({ contentVersion: 3 })).contentVersion).toBe(6)
  })

  it('旧客户端 × 新存档（v7）：needsUpgrade，sanitize 不执行、未知蓝图数据不被清洗落盘', () => {
    const future = {
      ...baseState(),
      contentVersion: 7,
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

  it('v4 存档允许引用已下线桌宠蓝图；引用其它未知蓝图仍 needsUpgrade', () => {
    const petSave = { ...baseState(), contentVersion: 4, activeBlueprintId: 'pet-cat' }
    expect(loadAndMigrate(petSave).state).not.toBeNull()
    const ghostSave = { ...baseState(), contentVersion: 4, activeBlueprintId: 'future-tower' }
    const loaded = loadAndMigrate(ghostSave)
    expect(loaded.state).toBeNull()
    expect(loaded.state === null && loaded.needsUpgrade).toBe(true)
  })

  it('导入/同步前置：更高内容版本（v7）返回 null，不覆盖本地', () => {
    const future = { ...baseState(), contentVersion: 7 }
    expect(prepareImport(future)).toBeNull()
    expect(prepareImport(baseState())?.contentVersion).toBe(CONTENT_VERSION)
    expect(prepareImport({ ...baseState(), contentVersion: 2 })?.contentVersion).toBe(6)
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
    const merged = mergeAppState(baseState({ contentVersion: 6 }), baseState({ contentVersion: 7 }))
    expect(merged.contentVersion).toBe(7)
    const mergedOld = mergeAppState(baseState({ contentVersion: CONTENT_VERSION }), baseState())
    expect(mergedOld.contentVersion).toBe(CONTENT_VERSION)
    // 双端都是显式旧版本时也不能把合并结果写低（真实路径已被 normalize，这里防御 API 误用）
    const bothOld = mergeAppState(
      baseState({ contentVersion: 1 }),
      baseState({ contentVersion: 1 })
    )
    expect(bothOld.contentVersion).toBe(CONTENT_VERSION)
    const v4WithV3 = mergeAppState(
      baseState({ contentVersion: 4 }),
      baseState({ contentVersion: 3 })
    )
    expect(v4WithV3.contentVersion).toBe(6)
  })

  it('本地存储未来内容版本（v7）：needsUpgrade 且原始存档字节不被改写', async () => {
    const future = JSON.stringify({ ...baseState(), contentVersion: 7 })
    localStorage.setItem(STATE_KEY, future)
    const res = await createLocalStorageAdapter().load()
    expect(res.state).toBeNull()
    expect(res.needsUpgrade).toBe(true)
    expect(localStorage.getItem(STATE_KEY)).toBe(future)
    localStorage.removeItem(STATE_KEY)
  })
})

describe('桌宠蓝图下线迁移（D-20261127-125）', () => {
  it('v4 的桌宠积木并入当前未完成建筑，宠物外键被清除', () => {
    const saved = baseState({
      contentVersion: 4,
      activeBlueprintId: 'pet-cat',
      completedBlueprintIds: ['pet-bot'],
      builds: [
        {
          id: 'cat-part',
          blueprintId: 'pet-cat',
          index: 0,
          placedAt: '2026-11-24T00:00:00.000Z',
          fromHabitId: 'h1',
          bonus: false
        }
      ],
      checkIns: [
        {
          id: 'c1',
          habitId: 'h1',
          date: '2026-11-24',
          at: '2026-11-24T00:00:00.000Z',
          placedBlockId: 'cat-part',
          blueprintId: 'pet-cat'
        }
      ],
      settings: { theme: 'light', language: 'zh' }
    })
    const loaded = loadAndMigrate(saved).state
    expect(loaded).not.toBeNull()
    expect(loaded!.activeBlueprintId).toBe('plant')
    expect(loaded!.completedBlueprintIds).toEqual([])
    expect(loaded!.builds).toEqual([
      expect.objectContaining({ id: 'cat-part', blueprintId: 'plant', index: 0 })
    ])
    expect(loaded!.checkIns[0].blueprintId).toBe('plant')
    expect(loaded!.checkIns[0].placedBlockId).toBe('cat-part')

    const imported = prepareImport(saved)
    expect(imported?.builds[0].blueprintId).toBe('plant')
    expect(imported?.checkIns[0].blueprintId).toBe('plant')
  })

  it('旧形象字段被忽略，不再进入设置', () => {
    const legacy = baseState({
      contentVersion: 4,
      settings: { theme: 'light', language: 'zh', petModel: 'cat' } as never
    })
    const settings = loadAndMigrate(legacy).state?.settings as unknown as Record<string, unknown>
    expect(settings.petSkin).toBeUndefined()
    expect(settings.petModel).toBeUndefined()
  })
})
