import { describe, it, expect } from 'vitest'
import { sanitizeState, validateState } from './adapter'

/**
 * A3 回归：存档里的蓝图外键必须校验。
 * 未知 activeBlueprintId / builds[].blueprintId 会让渲染层 getBlueprint 抛错 → 整树卸载白屏，
 * 且坏档会被立即落盘形成 crash loop。
 */
function base(over: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' },
    ...over
  }
}

function block(over: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    blueprintId: 'plant',
    index: 0,
    placedAt: new Date().toISOString(),
    fromHabitId: 'h1',
    bonus: false,
    ...over
  }
}

describe('存档蓝图外键校验', () => {
  it('validateState 接受合法外键', () => {
    const res = validateState(base({ builds: [block()] }))
    expect(res.ok).toBe(true)
  })

  it('validateState 拒绝未知 activeBlueprintId', () => {
    const res = validateState(base({ activeBlueprintId: 'ghost-castle' }))
    expect(res.ok).toBe(false)
  })

  it('validateState 拒绝 builds 里的未知 blueprintId', () => {
    const res = validateState(base({ builds: [block({ blueprintId: 'ghost-castle' })] }))
    expect(res.ok).toBe(false)
  })

  it('validateState 拒绝 completedBlueprintIds 里的未知 id', () => {
    const res = validateState(base({ completedBlueprintIds: ['plant', 'ghost-castle'] }))
    expect(res.ok).toBe(false)
  })

  it('sanitizeState 把未知 activeBlueprintId 回落到第一座蓝图（不白屏）', () => {
    const state = sanitizeState(base({ activeBlueprintId: 'ghost-castle' }))
    expect(state).not.toBeNull()
    expect(state!.activeBlueprintId).toBe('plant')
  })

  it('sanitizeState 丢弃未知蓝图的积木，保留合法积木', () => {
    const state = sanitizeState(
      base({
        builds: [block(), block({ id: 'b2', blueprintId: 'ghost-castle', index: 1 })],
        completedBlueprintIds: ['ghost-castle']
      })
    )
    expect(state).not.toBeNull()
    expect(state!.builds).toHaveLength(1)
    expect(state!.builds[0].blueprintId).toBe('plant')
    expect(state!.completedBlueprintIds).toEqual([])
  })
})
