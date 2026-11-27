import { describe, expect, it } from 'vitest'
import type { AppState, CheckIn, DayClaim, PlacedBlock } from '../types'
import { blueprints } from '../logic/blueprints'
import { migrateLegacyPetBlueprints } from './petBlueprintMigration'

function block(
  id: string,
  blueprintId: string,
  index: number,
  placedAt = '2026-11-24T00:00:00.000Z'
): PlacedBlock {
  return { id, blueprintId, index, placedAt, fromHabitId: 'h1', bonus: false }
}

function checkIn(
  id: string,
  placedBlockId: string,
  blueprintId: string,
  at = '2026-11-24T00:00:00.000Z'
): CheckIn {
  return { id, habitId: 'h1', date: at.slice(0, 10), at, placedBlockId, blueprintId }
}

function claim(
  date: string,
  blockId: string,
  blueprintId: string,
  claimedAt = `${date}T21:00:00.000Z`
): DayClaim {
  return { date, claimedAt, blockId, blueprintId }
}

function state(over: Partial<AppState> = {}): AppState {
  return {
    schemaVersion: 2,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' },
    dayClaims: [],
    showcasePlacements: [],
    ...over
  }
}

describe('migrateLegacyPetBlueprints（D-20261127-125）', () => {
  it('把宠物积木接在当前未完成建筑已有积木之后，并同步打卡事实', () => {
    const next = migrateLegacyPetBlueprints(
      state({
        builds: [
          block('p0', 'plant', 0),
          block('p1', 'plant', 1),
          block('c0', 'pet-cat', 0),
          block('c1', 'pet-cat', 1),
          block('c2', 'pet-cat', 2)
        ],
        checkIns: [
          checkIn('i0', 'p0', 'plant'),
          checkIn('i1', 'c0', 'pet-cat'),
          checkIn('i2', 'c1', 'pet-cat'),
          checkIn('i3', 'c2', 'pet-cat')
        ]
      })
    )

    const plantBlocks = next.builds.filter((b) => b.blueprintId === 'plant')
    expect(plantBlocks.map((b) => b.index)).toEqual([0, 1, 2, 3, 4])
    expect(next.builds.some((b) => b.blueprintId.startsWith('pet-'))).toBe(false)
    expect(next.checkIns.map((c) => c.blueprintId)).toEqual(['plant', 'plant', 'plant', 'plant'])
  })

  it('active 是宠物蓝图时改到第一座未完成主线建筑', () => {
    const next = migrateLegacyPetBlueprints(
      state({
        activeBlueprintId: 'pet-bot',
        builds: [block('b0', 'pet-bot', 0)],
        checkIns: [checkIn('i0', 'b0', 'pet-bot')]
      })
    )
    expect(next.activeBlueprintId).toBe('plant')
    expect(next.builds[0]).toMatchObject({ blueprintId: 'plant', index: 0 })
  })

  it('当前建筑填满后继续填下一座未完成建筑，并补登完成态与展台', () => {
    const plantCapacity = blueprints.plant.blocks.length
    const existing = Array.from({ length: plantCapacity - 1 }, (_, i) => block(`p${i}`, 'plant', i))
    const next = migrateLegacyPetBlueprints(
      state({
        builds: [
          ...existing,
          block('c0', 'pet-cat', 0),
          block('c1', 'pet-cat', 1),
          block('c2', 'pet-cat', 2)
        ],
        checkIns: [
          checkIn('i0', 'c0', 'pet-cat'),
          checkIn('i1', 'c1', 'pet-cat'),
          checkIn('i2', 'c2', 'pet-cat')
        ]
      })
    )

    expect(next.builds.filter((b) => b.blueprintId === 'plant')).toHaveLength(plantCapacity)
    expect(next.builds.filter((b) => b.blueprintId === 'coffee').map((b) => b.index)).toEqual([
      0, 1
    ])
    expect(next.completedBlueprintIds).toContain('plant')
    expect(next.showcasePlacements?.some((p) => p.blueprintId === 'plant')).toBe(true)
    expect(next.checkIns.map((c) => c.blueprintId)).toEqual(['plant', 'coffee', 'coffee'])
  })

  it('全勤块与宠物完成态一起迁移：完成列表与展台不再残留宠物 id', () => {
    const next = migrateLegacyPetBlueprints(
      state({
        completedBlueprintIds: ['pet-cat', 'coffee'],
        showcasePlacements: [{ blueprintId: 'pet-cat', gridX: 1, gridY: 1 }],
        builds: [block('d0', 'pet-bot', 0)],
        dayClaims: [claim('2026-11-24', 'd0', 'pet-bot')]
      })
    )
    expect(next.completedBlueprintIds).toEqual(['coffee'])
    expect(next.showcasePlacements?.every((p) => p.blueprintId !== 'pet-cat')).toBe(true)
    expect(next.dayClaims[0].blueprintId).toBe('plant')
  })

  it('只有事实、没有 build 行的宠物块会补出投影行，不占空槽也不造成假完成', () => {
    const next = migrateLegacyPetBlueprints(
      state({
        builds: [block('p0', 'plant', 0), block('b0', 'pet-cat', 0, '2026-11-25T00:00:00.000Z')],
        checkIns: [
          checkIn('i0', 'a0', 'pet-cat', '2026-11-24T00:00:00.000Z'),
          checkIn('i1', 'b0', 'pet-cat', '2026-11-25T00:00:00.000Z')
        ]
      })
    )
    const plant = next.builds.filter((b) => b.blueprintId === 'plant')
    expect(plant.map((b) => b.index)).toEqual([0, 1, 2])
    expect(plant.map((b) => b.id).sort()).toEqual(['a0', 'b0', 'p0'])
    expect(next.completedBlueprintIds).toEqual([])
  })

  it('目标建筑里的墓碑积木不会导致迁移块 index 冲突', () => {
    const next = migrateLegacyPetBlueprints(
      state({
        builds: [
          { ...block('t0', 'plant', 0), deletedAt: '2026-11-24T01:00:00.000Z' },
          block('p1', 'plant', 1),
          block('c0', 'pet-cat', 0)
        ],
        checkIns: [checkIn('i0', 'c0', 'pet-cat')]
      })
    )
    const indices = next.builds
      .filter((b) => b.blueprintId === 'plant')
      .map((b) => b.index)
      .sort((a, b) => a - b)
    expect(indices).toEqual([0, 1])
    expect(next.builds.some((b) => b.id === 't0')).toBe(false)
  })

  it('不同宠物蓝图共用同一个 block id 时只搬一块', () => {
    const next = migrateLegacyPetBlueprints(
      state({
        builds: [block('x', 'pet-cat', 0), block('x', 'pet-bot', 0)],
        checkIns: [checkIn('i0', 'x', 'pet-cat'), checkIn('i1', 'x', 'pet-bot')]
      })
    )
    expect(next.builds.filter((b) => b.id === 'x')).toHaveLength(1)
    expect(next.builds.filter((b) => b.blueprintId === 'plant')).toHaveLength(1)
  })

  it('showcasePlacements 含 null 时不会让迁移抛错', () => {
    expect(() =>
      migrateLegacyPetBlueprints(
        state({
          builds: [block('c0', 'pet-cat', 0)],
          checkIns: [checkIn('i0', 'c0', 'pet-cat')],
          showcasePlacements: [null as never]
        })
      )
    ).not.toThrow()
  })

  it('active 是宠物且目标被填满时，落到下一座仍未完成的建筑', () => {
    const plantCapacity = blueprints.plant.blocks.length
    const existing = Array.from({ length: plantCapacity - 1 }, (_, i) => block(`p${i}`, 'plant', i))
    const next = migrateLegacyPetBlueprints(
      state({
        activeBlueprintId: 'pet-cat',
        builds: [...existing, block('c0', 'pet-cat', 0), block('c1', 'pet-cat', 1)],
        checkIns: [checkIn('i0', 'c0', 'pet-cat'), checkIn('i1', 'c1', 'pet-cat')]
      })
    )
    expect(next.builds.filter((b) => b.blueprintId === 'plant')).toHaveLength(plantCapacity)
    expect(next.activeBlueprintId).toBe('coffee')
  })

  it('宠物超过旧容量时优先保留旧 builds 里已可见的块', () => {
    const visible = Array.from({ length: 12 }, (_, i) => block(`v${i}`, 'pet-cat', i))
    const next = migrateLegacyPetBlueprints(
      state({
        builds: visible,
        checkIns: [
          // 更早的事实块没有 build 行；不能把 12 个可见块挤出旧容量。
          checkIn('i-extra', 'extra', 'pet-cat', '2026-01-01T00:00:00.000Z'),
          ...visible.map((b) => checkIn(`i-${b.id}`, b.id, 'pet-cat'))
        ]
      })
    )
    const ids = new Set(next.builds.map((b) => b.id))
    for (const b of visible) expect(ids.has(b.id)).toBe(true)
    expect(ids.has('extra')).toBe(false)
  })

  it('没有任何宠物外键时原样返回', () => {
    const original = state({ builds: [block('p0', 'plant', 0)] })
    expect(migrateLegacyPetBlueprints(original)).toBe(original)
  })

  it('所有建筑都已完成时，宠物积木没有落位就只保留打卡、不产生假积木', () => {
    const completed = Object.keys(blueprints)
    const fullBuilds = completed.flatMap((id) =>
      Array.from({ length: blueprints[id].blocks.length }, (_, i) => block(`${id}-${i}`, id, i))
    )
    const next = migrateLegacyPetBlueprints(
      state({
        completedBlueprintIds: completed,
        builds: [...fullBuilds, block('c0', 'pet-cat', 0)],
        checkIns: [checkIn('i0', 'c0', 'pet-cat')]
      })
    )
    expect(next.builds.some((b) => b.id === 'c0')).toBe(false)
    const preserved = next.checkIns.find((c) => c.id === 'i0')
    expect(preserved).toBeDefined()
    expect(preserved!.placedBlockId).toBeUndefined()
    expect(preserved!.blueprintId).toBeUndefined()
  })
})
