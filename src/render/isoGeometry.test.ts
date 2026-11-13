import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ISO_CONFIG,
  depth,
  followResize,
  rotateCoord,
  STUD_H,
  worldToScreen
} from './isoGeometry'

/**
 * D-20261110-043：等距投影数学是渲染底座（E4 拆分后此前只有间接覆盖）。
 * 断言的是**投影不变量**，不是具体像素值——这样改 tileW/blockH 时测试仍然有意义。
 */
const C = DEFAULT_ISO_CONFIG

describe('worldToScreen', () => {
  it('原点在 (0,0)', () => {
    expect(worldToScreen(0, 0, 0, C)).toEqual({ sx: 0, sy: 0 })
  })

  it('x+1 → 右移半格、下移半格高（等距 2:1）', () => {
    const a = worldToScreen(1, 0, 0, C)
    expect(a.sx).toBe(C.tileW / 2)
    expect(a.sy).toBe(C.tileH / 2)
    expect(a.sx / a.sy).toBeCloseTo(2, 10) // 2:1 菱形比例
  })

  it('y+1 → 左移半格、下移半格高（与 x 镜像）', () => {
    const a = worldToScreen(0, 1, 0, C)
    expect(a.sx).toBe(-C.tileW / 2)
    expect(a.sy).toBe(C.tileH / 2)
  })

  it('z+1 → 纯上移一个块高（不改变水平位置）', () => {
    const a = worldToScreen(0, 0, 1, C)
    expect(a.sx).toBe(0)
    expect(a.sy).toBe(-C.blockH)
  })

  it('x 与 y 交换 → 水平镜像、垂直不变', () => {
    const a = worldToScreen(3, 1, 0, C)
    const b = worldToScreen(1, 3, 0, C)
    expect(a.sx).toBe(-b.sx)
    expect(a.sy).toBe(b.sy)
  })

  it('沿对角线 (n,n) 移动只下移、不横移', () => {
    const a = worldToScreen(5, 5, 0, C)
    expect(a.sx).toBe(0)
    expect(a.sy).toBe(5 * C.tileH)
  })

  it('块高与凸点高度都为正（渲染方向依赖符号）', () => {
    expect(C.blockH).toBeGreaterThan(0)
    expect(STUD_H).toBeGreaterThan(0)
  })
})

describe('rotateCoord', () => {
  const cx = 4
  const cy = 7

  it('rot=0 恒等', () => {
    expect(rotateCoord(6, 9, cx, cy, 0)).toEqual({ rx: 6, ry: 9 })
  })

  it('中心点旋转后不动', () => {
    for (const rot of [0, 1, 2, 3]) {
      const p = rotateCoord(cx, cy, cx, cy, rot)
      expect(p).toEqual({ rx: cx, ry: cy })
    }
  })

  it('旋转四次回到原点（90° × 4 = 360°）', () => {
    let x = 6
    let y = 9
    for (let i = 0; i < 4; i++) {
      const p = rotateCoord(x, y, cx, cy, 1)
      x = p.rx
      y = p.ry
    }
    expect({ rx: x, ry: y }).toEqual({ rx: 6, ry: 9 })
  })

  it('rot=2（180°）等价于两次 90°', () => {
    const once = rotateCoord(6, 9, cx, cy, 1)
    const twice = rotateCoord(once.rx, once.ry, cx, cy, 1)
    expect(twice).toEqual(rotateCoord(6, 9, cx, cy, 2))
  })

  it('负数与超范围 rot 都归一化到 0..3', () => {
    expect(rotateCoord(6, 9, cx, cy, -1)).toEqual(rotateCoord(6, 9, cx, cy, 3))
    expect(rotateCoord(6, 9, cx, cy, 5)).toEqual(rotateCoord(6, 9, cx, cy, 1))
    expect(rotateCoord(6, 9, cx, cy, 8)).toEqual(rotateCoord(6, 9, cx, cy, 0))
  })

  it('旋转保距（到中心距离不变）', () => {
    for (const rot of [0, 1, 2, 3]) {
      const p = rotateCoord(9, 2, cx, cy, rot)
      expect(Math.hypot(p.rx - cx, p.ry - cy)).toBeCloseTo(Math.hypot(9 - cx, 2 - cy), 10)
    }
  })
})

describe('depth', () => {
  it('画家算法键随 x/y/z 单调递增', () => {
    expect(depth(0, 0, 0)).toBe(0)
    expect(depth(1, 0, 0)).toBe(1)
    expect(depth(5, 3, 2)).toBe(10)
  })
})

describe('followResize', () => {
  const view = { scale: 1.5, panX: 30, panY: -20 }
  const center = { x: 100, y: 60 }

  it('窗口尺寸不变 → 视图不变', () => {
    const next = followResize(view, { w: 800, h: 600 }, { w: 800, h: 600 }, center)
    expect(next.scale).toBeCloseTo(view.scale, 10)
    expect(next.panX).toBeCloseTo(view.panX, 10)
    expect(next.panY).toBeCloseTo(view.panY, 10)
  })

  it('放大再还原是精确逆变换（最大化→还原不漂移）', () => {
    const big = followResize(view, { w: 800, h: 600 }, { w: 1600, h: 1200 }, center)
    const back = followResize(big, { w: 1600, h: 1200 }, { w: 800, h: 600 }, center)
    expect(back.scale).toBeCloseTo(view.scale, 10)
    expect(back.panX).toBeCloseTo(view.panX, 10)
    expect(back.panY).toBeCloseTo(view.panY, 10)
  })

  it('缩放钳制在 [0.3, 3]', () => {
    const tiny = followResize(view, { w: 800, h: 600 }, { w: 8, h: 6 }, center)
    expect(tiny.scale).toBe(0.3)
    const huge = followResize(view, { w: 800, h: 600 }, { w: 80000, h: 60000 }, center)
    expect(huge.scale).toBe(3)
  })

  it('模型中心保持在窗口中的相对位置', () => {
    const next = followResize(view, { w: 800, h: 600 }, { w: 1200, h: 900 }, center)
    // 屏幕坐标 = iso × scale + pan
    const relBefore = (view.panX + center.x * view.scale) / 800
    const relAfter = (next.panX + center.x * next.scale) / 1200
    expect(relAfter).toBeCloseTo(relBefore, 10)
  })
})
