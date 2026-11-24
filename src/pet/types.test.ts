import { describe, expect, it } from 'vitest'
import { isPetSkinUnlocked, petSizeScale } from './types'

describe('pet types（D-20261124-088）', () => {
  it('大小映射为角色缩放', () => {
    expect(petSizeScale('small')).toBeLessThan(petSizeScale('medium'))
    expect(petSizeScale('large')).toBeGreaterThan(petSizeScale('medium'))
    expect(petSizeScale('medium')).toBe(1)
  })

  it('积木默认可用，机器人完成 1 座建筑后解锁', () => {
    expect(isPetSkinUnlocked('block', 0)).toBe(true)
    expect(isPetSkinUnlocked('robot', 0)).toBe(false)
    expect(isPetSkinUnlocked('robot', 1)).toBe(true)
  })
})
