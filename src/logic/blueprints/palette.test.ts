import { describe, expect, it } from 'vitest'
import { blueprintOrder, blueprints } from './index'
import {
  APPROVED_BLUEPRINT_COLORS,
  BLUEPRINT_COLOR_PLAN,
  familyOf,
  isAccentColor,
} from './palette'

describe('蓝图色彩系统（D-20261111-067）', () => {
  it('每一座蓝图都有配色计划，且没有多余计划', () => {
    expect(Object.keys(BLUEPRINT_COLOR_PLAN).sort()).toEqual([...blueprintOrder].sort())
  })

  it('声明的每个角色色都实际出现在对应模型里', () => {
    for (const id of blueprintOrder) {
      const bp = blueprints[id]
      const used = new Set(bp.blocks.map((b) => b.color).filter((c): c is string => Boolean(c)))
      const plan = BLUEPRINT_COLOR_PLAN[id]
      for (const [role, color] of Object.entries(plan.roles)) {
        expect(used.has(color), `${id}.${role} 期望 ${color}`).toBe(true)
      }
    }
  })

  it('每座至少 3 个颜色角色、跨 2 个材质家族，且彩色比例达标', () => {
    for (const id of blueprintOrder) {
      const bp = blueprints[id]
      const plan = BLUEPRINT_COLOR_PLAN[id]
      const colored = bp.blocks.filter((b) => Boolean(b.color))
      const distinct = new Set(colored.map((b) => b.color!))
      expect(distinct.size, `${id} 颜色数`).toBeGreaterThanOrEqual(3)
      const families = new Set([...distinct].map((c) => familyOf(c)))
      expect(families.size, `${id} 材质家族数`).toBeGreaterThanOrEqual(2)
      const ratio = colored.length / bp.blocks.length
      expect(ratio, `${id} 彩色比例 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(plan.minRatio ?? 0.15)
    }
  })

  it('非中性强调色占比达标（earth/warm/cool/life/signal；默认下限 8%）', () => {
    for (const id of blueprintOrder) {
      const bp = blueprints[id]
      const plan = BLUEPRINT_COLOR_PLAN[id]
      const accent = bp.blocks.filter((block) => block.color && isAccentColor(block.color)).length
      const ratio = accent / bp.blocks.length
      const min = plan.minAccentRatio ?? 0.08
      expect(ratio, `${id} accent 占比 ${(ratio * 100).toFixed(1)}% < ${(min * 100).toFixed(0)}%`).toBeGreaterThanOrEqual(min)
    }
  })

  it('所有模型使用的颜色都在批准材质调色板内', () => {
    for (const id of blueprintOrder) {
      for (const block of blueprints[id].blocks) {
        if (block.color) expect(APPROVED_BLUEPRINT_COLORS.has(block.color), `${id} 使用了未批准颜色 ${block.color}`).toBe(true)
      }
    }
  })
})
