import { describe, it, expect } from 'vitest'
import {
  worldToScreen,
  depth,
  adjustLightness,
  withAlpha,
  deriveShading,
  deriveShadingForColor,
  followResize,
  rotateCoord,
  DEFAULT_ISO_CONFIG,
  STUD_H,
  pointInPoly,
  isPointInsideCube,
  type IsoConfig,
  type IsoPalette
} from './iso'
describe('worldToScreen', () => {
  const c: IsoConfig = { tileW: 64, tileH: 32, blockH: 24 }

  it('origin maps to (0,0)', () => {
    expect(worldToScreen(0, 0, 0, c)).toEqual({ sx: 0, sy: 0 })
  })

  it('+x goes right-down, +y goes left-down (symmetric)', () => {
    const a = worldToScreen(1, 0, 0, c)
    const b = worldToScreen(0, 1, 0, c)
    expect(a).toEqual({ sx: 32, sy: 16 })
    expect(b).toEqual({ sx: -32, sy: 16 })
  })

  it('+z raises sy only', () => {
    const p = worldToScreen(2, 3, 1, c)
    const q = worldToScreen(2, 3, 0, c)
    expect(p.sx).toBe(q.sx)
    expect(p.sy).toBe(q.sy - 24)
  })
})

describe('depth', () => {
  it('orders cubes for painter algorithm', () => {
    expect(depth(0, 0, 0)).toBeLessThan(depth(0, 0, 1))
    expect(depth(0, 0, 1)).toBeLessThan(depth(1, 1, 0))
    expect(depth(1, 1, 1)).toBe(3)
  })
})

describe('DEFAULT_ISO_CONFIG', () => {
  it('keeps blueprint tile footprint, block body 1:1:1.2, stud layer +5', () => {
    expect(DEFAULT_ISO_CONFIG.tileW).toBe(48)
    expect(DEFAULT_ISO_CONFIG.tileH).toBe(24)
    // v3：块身高 29（宽:深:高 = 1:1:1.2）
    expect(DEFAULT_ISO_CONFIG.blockH).toBe(29)
    expect(STUD_H).toBe(5)
  })
})

describe('color derivation', () => {
  it('adjustLightness scales L multiplicatively', () => {
    expect(adjustLightness('#808080', 1)).toBe('rgb(128,128,128)')
    expect(adjustLightness('#808080', 0)).toBe('rgb(0,0,0)')
    // L≈50% 的灰 ×0.92 → L≈46% ≈ rgb(118)
    expect(adjustLightness('#808080', 0.92)).toBe('rgb(118,118,118)')
  })

  it('adjustLightness clamps near-white', () => {
    // L≈95.7% ×1.08 > 100% → 鉗制为纯白
    expect(adjustLightness('#f4f4f4', 1.08)).toBe('rgb(255,255,255)')
  })

  it('withAlpha builds rgba from hex', () => {
    expect(withAlpha('#0a0a0a', 0.55)).toBe('rgba(10,10,10,0.55)')
  })
})

describe('followResize', () => {
  const origin = { x: 0, y: 0 }

  it('窗口等比放大：视图等比放大，模型中心相对位置不变', () => {
    // 模型中心（等距原点）在 (100, 50) → 放大后仍在窗口 10%、6.25% 处
    const next = followResize(
      { scale: 1, panX: 100, panY: 50 },
      { w: 1000, h: 800 },
      { w: 2000, h: 1600 },
      origin
    )
    expect(next.scale).toBe(2)
    expect(next.panX).toBe(200)
    expect(next.panY).toBe(100)
  })

  it('非等比变化（如最大化）：按面积比平方根缩放，中心保持窗口内相对位置', () => {
    const view = { scale: 0.8, panX: 440, panY: 380 } // 1100×760 窗口，中心在 40%、50% 处
    const next = followResize(view, { w: 1100, h: 760 }, { w: 2560, h: 1392 }, origin)
    expect(next.scale).toBeCloseTo(0.8 * Math.sqrt((2560 * 1392) / (1100 * 760)))
    expect(next.panX).toBeCloseTo(0.4 * 2560)
    expect(next.panY).toBeCloseTo(0.5 * 1392)
  })

  it('还原是精确逆变换：最大化再还原后视图复原', () => {
    const view = { scale: 1.2, panX: 300, panY: 200 }
    const center = { x: 40, y: -60 }
    const maxed = followResize(view, { w: 1100, h: 760 }, { w: 2560, h: 1392 }, center)
    const back = followResize(maxed, { w: 2560, h: 1392 }, { w: 1100, h: 760 }, center)
    expect(back.scale).toBeCloseTo(1.2)
    expect(back.panX).toBeCloseTo(300)
    expect(back.panY).toBeCloseTo(200)
  })

  it('缩放钳制在 [0.3, 3]，与滚轮缩放一致', () => {
    const up = followResize(
      { scale: 2.9, panX: 0, panY: 0 },
      { w: 1000, h: 1000 },
      { w: 3000, h: 3000 },
      origin
    )
    expect(up.scale).toBe(3)
    const down = followResize(
      { scale: 0.4, panX: 0, panY: 0 },
      { w: 3000, h: 3000 },
      { w: 1000, h: 1000 },
      origin
    )
    expect(down.scale).toBeCloseTo(0.3)
  })
})

describe('deriveShading (v3 光照比例)', () => {
  const palette: IsoPalette = {
    top: '#f4f4f4',
    left: '#c9c9c9',
    right: '#3d3d3d',
    ghost: '',
    line: '',
    accent: '',
    ink: '#0a0a0a'
  }

  it('anchors each face CSS variable as the brightest edge', () => {
    const sh = deriveShading(palette)
    expect(sh.topA).toBe('rgb(244,244,244)')
    expect(sh.leftA).toBe('rgb(201,201,201)')
    expect(sh.rightA).toBe('rgb(61,61,61)')
  })

  it('applies v3 gradient ratios: top 100→90, left 65→50, right 35→22', () => {
    const sh = deriveShading(palette)
    expect(sh.topB).toBe(adjustLightness('#f4f4f4', 0.9))
    expect(sh.leftB).toBe(adjustLightness('#c9c9c9', 50 / 65))
    expect(sh.rightB).toBe(adjustLightness('#3d3d3d', 22 / 35))
  })

  it('stud top is +8% brighter than block top (clamped)', () => {
    const sh = deriveShading(palette)
    expect(sh.studTop).toBe(adjustLightness(adjustLightness('#f4f4f4', 1), 1.08))
  })
})

describe('rotateCoord (4-quadrant 90° rotation)', () => {
  const cx = 2
  const cy = 2

  it('rot=0 returns original coordinates', () => {
    expect(rotateCoord(3, 2, cx, cy, 0)).toEqual({ rx: 3, ry: 2 })
  })

  it('rot=1 rotates 90° clockwise', () => {
    // (3, 2) -> dx=1, dy=0 -> dx'=0, dy'=1 -> (2, 3)
    expect(rotateCoord(3, 2, cx, cy, 1)).toEqual({ rx: 2, ry: 3 })
  })

  it('rot=2 rotates 180°', () => {
    // (3, 2) -> dx=1, dy=0 -> dx'=-1, dy'=0 -> (1, 2)
    expect(rotateCoord(3, 2, cx, cy, 2)).toEqual({ rx: 1, ry: 2 })
  })

  it('rot=3 rotates 270°', () => {
    // (3, 2) -> dx=1, dy=0 -> dx'=0, dy'=-1 -> (2, 1)
    expect(rotateCoord(3, 2, cx, cy, 3)).toEqual({ rx: 2, ry: 1 })
  })

  it('rot=4 completes full circle back to start', () => {
    expect(rotateCoord(3, 2, cx, cy, 4)).toEqual({ rx: 3, ry: 2 })
  })
})

describe('deriveShadingForColor', () => {
  it('generates physically consistent isometric highlights and shadows for hex color', () => {
    const terracotta = '#b4533c'
    const sh = deriveShadingForColor(terracotta)
    expect(sh.topA).toBeDefined()
    expect(sh.topB).toBeDefined()
    expect(sh.leftA).toBeDefined()
    expect(sh.rightA).toBeDefined()
    expect(sh.studTop).toBeDefined()
  })
})

describe('hit testing', () => {
  it('pointInPoly correctly detects point inside quad', () => {
    const poly: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10]
    ]
    expect(pointInPoly(5, 5, poly)).toBe(true)
    expect(pointInPoly(15, 5, poly)).toBe(false)
    expect(pointInPoly(-2, 5, poly)).toBe(false)
  })

  it('isPointInsideCube hits center of cube and misses outside', () => {
    const sx = 100
    const sy = 100
    expect(isPointInsideCube(sx, sy, sx, sy)).toBe(true)
    expect(isPointInsideCube(sx + 200, sy, sx, sy)).toBe(false)
    expect(isPointInsideCube(sx, sy + 200, sx, sy)).toBe(false)
  })
})
