import { describe, expect, it } from 'vitest'
import { APPROVED_BLUEPRINT_COLORS } from '../logic/blueprints/palette'
import { getBlueprint } from '../logic/blueprints'
import { PET_COLORS, normalizePetColor, petSizeScale, resolvePetModel } from './types'

describe('pet types（D-20261124-088）', () => {
  it('大小映射为角色缩放', () => {
    expect(petSizeScale('small')).toBeLessThan(petSizeScale('medium'))
    expect(petSizeScale('large')).toBeGreaterThan(petSizeScale('medium'))
    expect(petSizeScale('medium')).toBe(0.9)
  })

  it('旧桌宠蓝图完成后才使用对应形象', () => {
    const total = getBlueprint('pet-cat').blocks.length
    const complete = Array.from({ length: total }, (_, index) => ({
      id: `b${index}`,
      blueprintId: 'pet-cat',
      index,
      placedAt: '2026-11-24T00:00:00.000Z',
      fromHabitId: 'h',
      bonus: false
    }))
    expect(resolvePetModel('cat', [])).toBe('block')
    expect(resolvePetModel('cat', complete)).toBe('cat')
    expect(resolvePetModel('block', [])).toBe('block')
  })

  it('桌宠颜色只接受已批准材质色，未知值回落主题', () => {
    for (const color of PET_COLORS) expect(APPROVED_BLUEPRINT_COLORS.has(color)).toBe(true)
    expect(normalizePetColor(PET_COLORS[0])).toBe(PET_COLORS[0])
    expect(normalizePetColor('#123456')).toBeUndefined()
    expect(normalizePetColor('red')).toBeUndefined()
  })
})
