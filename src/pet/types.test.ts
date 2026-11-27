import { describe, expect, it } from 'vitest'
import { APPROVED_BLUEPRINT_COLORS } from '../logic/blueprints/palette'
import { PET_COLORS, normalizePetColor, petSizeScale } from './types'

describe('pet types（D-20261124-088 / D-20261127-125）', () => {
  it('大小映射为角色缩放', () => {
    expect(petSizeScale('small')).toBeLessThan(petSizeScale('medium'))
    expect(petSizeScale('large')).toBeGreaterThan(petSizeScale('medium'))
    expect(petSizeScale('medium')).toBe(0.9)
  })

  it('桌宠颜色只接受已批准材质色，未知值回落主题', () => {
    for (const color of PET_COLORS) expect(APPROVED_BLUEPRINT_COLORS.has(color)).toBe(true)
    expect(normalizePetColor(PET_COLORS[0])).toBe(PET_COLORS[0])
    expect(normalizePetColor('#123456')).toBeUndefined()
    expect(normalizePetColor('red')).toBeUndefined()
  })

  // D-20261126-114：色板扩到 11 色，加「跟随主题」在 6 列网格里正好两行
  it('色板数量与 6 列网格对齐（跟随主题 + 材质色 = 12 格）', () => {
    expect(PET_COLORS.length).toBe(11)
    expect((PET_COLORS.length + 1) % 6).toBe(0)
    expect(new Set(PET_COLORS).size).toBe(PET_COLORS.length)
  })
})
