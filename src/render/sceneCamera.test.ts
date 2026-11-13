import { describe, expect, it } from 'vitest'
import {
  computeFitView,
  EARLY_ZOOM_CAP,
  FIT_PAD,
  MAX_FIT_SCALE,
  VERTICAL_CENTER_RATIO
} from './sceneCamera'

/**
 * D-20261110-044：取景数学（E5 拆分自 BuildScene.tsx，D10 的取舍）。
 * 断言：留白内可见、两条上限、中心位置、开荒期放大上限。
 */
const square = (half: number) => ({ minX: -half, maxX: half, minY: -half, maxY: half })

describe('computeFitView', () => {
  it('小模型按留白拟合（受宽高较小者限制）', () => {
    const v = computeFitView({
      bounds: square(100),
      allBounds: square(100),
      width: 800,
      height: 600
    })
    // 高度方向更紧：(600 - 96) / 200 = 2.52 → 受 MAX_FIT_SCALE 2 限制
    expect(v.scale).toBe(MAX_FIT_SCALE)
  })

  it('大模型：留白保证包围盒落在画布内', () => {
    const bounds = square(500)
    const v = computeFitView({ bounds, allBounds: bounds, width: 800, height: 600 })
    expect(v.scale).toBeCloseTo((600 - FIT_PAD * 2) / 1000, 10)
    // 左边距与上边距 >= 留白
    expect(bounds.minX * v.scale + v.panX).toBeGreaterThanOrEqual(FIT_PAD - 1e-6)
    expect(bounds.minY * v.scale + v.panY).toBeGreaterThanOrEqual(FIT_PAD - 1e-6)
  })

  it('缩放上限 MAX_FIT_SCALE（不会把模型放到离谱）', () => {
    const v = computeFitView({ bounds: square(1), allBounds: square(1), width: 4000, height: 4000 })
    expect(v.scale).toBe(MAX_FIT_SCALE)
  })

  it('开荒期放大上限：不超过整蓝图铺满的 1.5 倍', () => {
    const placed = square(20)
    const all = square(400)
    const v = computeFitView({ bounds: placed, allBounds: all, width: 800, height: 600 })
    const allScale = Math.min((800 - FIT_PAD * 2) / 800, (600 - FIT_PAD * 2) / 800, MAX_FIT_SCALE)
    expect(v.scale).toBeLessThanOrEqual(Math.min(MAX_FIT_SCALE, allScale * EARLY_ZOOM_CAP))
    // 且确实放大了（比按整蓝图取景更大）
    expect(v.scale).toBeGreaterThanOrEqual(allScale)
  })

  it('模型中心水平居中、垂直偏下', () => {
    const bounds = { minX: 10, maxX: 30, minY: 40, maxY: 60 }
    const v = computeFitView({ bounds, allBounds: bounds, width: 800, height: 600 })
    expect(((bounds.minX + bounds.maxX) / 2) * v.scale + v.panX).toBeCloseTo(400, 10)
    expect(((bounds.minY + bounds.maxY) / 2) * v.scale + v.panY).toBeCloseTo(
      600 * VERTICAL_CENTER_RATIO,
      10
    )
  })

  it('自定义留白生效', () => {
    const bounds = square(500)
    const a = computeFitView({ bounds, allBounds: bounds, width: 800, height: 600, pad: 0 })
    const b = computeFitView({ bounds, allBounds: bounds, width: 800, height: 600, pad: 100 })
    expect(a.scale).toBeGreaterThan(b.scale)
  })
})
