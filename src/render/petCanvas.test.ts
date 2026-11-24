import { describe, expect, it } from 'vitest'
import { petLayout } from './petCanvas'
import { petSizeScale, type PetSize } from '../pet/types'

const PET_WINDOW = { w: 96, h: 128 }
const PAD = 2

/**
 * 桌宠窗口收紧后的取景契约：脚底贴近窗口底部，且三档尺寸在跳跃峰值与侧身转体时
 * 都不越出画布。具体像素包围盒由浏览器 `?pet-preview` 的 alpha 扫描复核。
 */
describe('petLayout', () => {
  it('anchors feet above the bottom edge instead of centering vertically', () => {
    const layout = petLayout(PET_WINDOW.w, PET_WINDOW.h)
    expect(layout.floor).toBe(118)
    expect(layout.floor).toBeGreaterThan(PET_WINDOW.h / 2)
  })

  it('fits every size and the largest side-turn / hop envelope inside the window', () => {
    const layout = petLayout(PET_WINDOW.w, PET_WINDOW.h)
    for (const size of ['small', 'medium', 'large'] as PetSize[]) {
      const scale = layout.scale * petSizeScale(size)
      expect(layout.artWidth * scale).toBeLessThanOrEqual(PET_WINDOW.w - PAD * 2)
      expect(layout.artHeight * scale).toBeLessThanOrEqual(layout.floor - PAD)
    }
  })
})
