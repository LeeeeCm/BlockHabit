import { describe, expect, it } from 'vitest'
import { APPROVED_BLUEPRINT_COLORS } from '../logic/blueprints/palette'
import { PET_COLORS, isPetSkinUnlocked, normalizePetColor, petSizeScale } from './types'

describe('pet types（D-20261124-088）', () => {
  it('大小映射为角色缩放', () => {
    expect(petSizeScale('small')).toBeLessThan(petSizeScale('medium'))
    expect(petSizeScale('large')).toBeGreaterThan(petSizeScale('medium'))
    expect(petSizeScale('medium')).toBe(1)
  })

  it('积木默认可用，猫完成 3 座建筑后解锁', () => {
    expect(isPetSkinUnlocked('block', 0)).toBe(true)
    expect(isPetSkinUnlocked('cat', 2)).toBe(false)
    expect(isPetSkinUnlocked('cat', 3)).toBe(true)
  })

  it('桌宠颜色只接受已批准材质色，未知值回落主题', () => {
    for (const color of PET_COLORS) expect(APPROVED_BLUEPRINT_COLORS.has(color)).toBe(true)
    expect(normalizePetColor(PET_COLORS[0])).toBe(PET_COLORS[0])
    expect(normalizePetColor('#123456')).toBeUndefined()
    expect(normalizePetColor('red')).toBeUndefined()
  })
})
