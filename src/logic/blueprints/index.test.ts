import { describe, expect, it, vi } from 'vitest'
import { blueprintOrder, blueprints, getBlueprint } from './index'

/**
 * D-20261110-042：蓝图注册表此前无单测。
 * getBlueprint 的「未知 id 回落」是 A7（脏数据不白屏）的实现细节，必须锁住。
 */
describe('blueprints 注册表', () => {
  it('全部蓝图（基础 12 + 内容包 v2 6 + v3 5）按 order 注册，id 与键一致', () => {
    expect(blueprintOrder).toHaveLength(23)
    for (const id of blueprintOrder) {
      expect(blueprints[id]).toBeDefined()
      expect(blueprints[id].id).toBe(id)
    }
    expect(Object.keys(blueprints).sort()).toEqual([...blueprintOrder].sort())
  })

  it('每座蓝图都有块，且同蓝图内坐标唯一（重复坐标会导致积木重叠）', () => {
    for (const id of blueprintOrder) {
      const blocks = blueprints[id].blocks
      expect(blocks.length).toBeGreaterThan(0)
      const keys = blocks.map((b) => `${b.x},${b.y},${b.z}`)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('getBlueprint 已知 id 原样返回', () => {
    expect(getBlueprint('castle').id).toBe('castle')
  })

  it('未知 id 回落第一座蓝图并告警（不抛错、不白屏）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const bp = getBlueprint('does-not-exist')
    expect(bp.id).toBe(blueprintOrder[0])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
