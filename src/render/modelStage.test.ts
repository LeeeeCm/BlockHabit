import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BlockDef } from '../types'

/**
 * modelStage 是画报/相纸/图鉴/年鉴四处共用的等距舞台（B2 抽取）。
 * 这里锁定「measure → fit → painter」的数值契约与绘制顺序契约：
 * 一旦有人改了 padding/baseline/排序/凸点省略规则，四处消费者会一起变——
 * 因此这些断言必须比单表面测试更严格（精确数值，不做近似）。
 */

const spies = vi.hoisted(() => ({
  drawCube: vi.fn(),
  drawGroundBase: vi.fn()
}))

vi.mock('./iso', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./iso')>()
  return {
    ...actual,
    drawCube: (...args: unknown[]) => spies.drawCube(...args),
    drawGroundBase: (...args: unknown[]) => spies.drawGroundBase(...args)
  }
})

import { DEFAULT_ISO_CONFIG, STUD_H, worldToScreen, type IsoPalette } from './iso'
import {
  fitModelInto,
  measureModelBounds,
  modelGroundCenter,
  paintModel,
  paintModelStage,
  prepareModelCanvas,
  type ModelBounds
} from './modelStage'

const PALETTE: IsoPalette = {
  top: '#ffffff',
  left: '#e2e8f0',
  right: '#cbd5e1',
  ghost: 'rgba(0,0,0,0.06)',
  line: '#94a3b8',
  accent: '#c25e3e',
  ink: '#0f172a'
}

/** 只记录 transform / save / restore 的假 context：drawCube 已被 mock，不碰真实画布 */
function createTransformContext() {
  const calls: Array<{ name: string; args: number[] }> = []
  const ctx = {
    save: () => calls.push({ name: 'save', args: [] }),
    restore: () => calls.push({ name: 'restore', args: [] }),
    translate: (x: number, y: number) => calls.push({ name: 'translate', args: [x, y] }),
    scale: (x: number, y: number) => calls.push({ name: 'scale', args: [x, y] }),
    setTransform: (...args: number[]) => calls.push({ name: 'setTransform', args }),
    clearRect: (...args: number[]) => calls.push({ name: 'clearRect', args })
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

function block(x: number, y: number, z: number, extra: Partial<BlockDef> = {}): BlockDef {
  return { x, y, z, type: 'basic', ...extra }
}

function cubeArgs(callIndex: number) {
  const call = spies.drawCube.mock.calls[callIndex]
  return {
    sx: call[1] as number,
    sy: call[2] as number,
    options: call[5] as Record<string, unknown>
  }
}

afterEach(() => {
  spies.drawCube.mockClear()
  spies.drawGroundBase.mockClear()
})

describe('measureModelBounds：屏幕空间包围盒', () => {
  it('单块：含凸点顶部与块体底部（与 iso 几何逐字一致）', () => {
    const bounds = measureModelBounds([block(0, 0, 0)])
    const { sx, sy } = worldToScreen(0, 0, 0, DEFAULT_ISO_CONFIG)
    expect(bounds.minX).toBe(sx - DEFAULT_ISO_CONFIG.tileW / 2)
    expect(bounds.maxX).toBe(sx + DEFAULT_ISO_CONFIG.tileW / 2)
    expect(bounds.minY).toBe(sy - DEFAULT_ISO_CONFIG.tileH / 2 - STUD_H)
    expect(bounds.maxY).toBe(sy + DEFAULT_ISO_CONFIG.tileH / 2 + DEFAULT_ISO_CONFIG.blockH)
  })

  it('空模型返回零包围盒（调用方据此跳过 fit，不产生 NaN）', () => {
    expect(measureModelBounds([])).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 })
  })

  it('多块取并集；抬升 z 会减小 minY（更高）但不改变 X 范围', () => {
    const low = measureModelBounds([block(0, 0, 0)])
    const high = measureModelBounds([block(0, 0, 3)])
    expect(high.minY).toBeLessThan(low.minY)
    expect(high.minX).toBe(low.minX)
    expect(high.maxX).toBe(low.maxX)
  })
})

describe('fitModelInto：等比塞进视口', () => {
  const bounds: ModelBounds = { minX: -100, maxX: 100, minY: -50, maxY: 150 }
  const viewport = { x: 20, y: 30, w: 300, h: 200 }

  it('pad 数字：四边等距，且缩放不超过 maxScale', () => {
    const fit = fitModelInto(bounds, viewport, 10, 1.5, 0.5)
    const availableW = viewport.w - 20
    const availableH = viewport.h - 20
    expect(fit.scale).toBe(Math.min(availableW / 200, availableH / 200, 1.5))
    const left = bounds.minX * fit.scale + fit.panX
    const top = bounds.minY * fit.scale + fit.panY
    const right = bounds.maxX * fit.scale + fit.panX
    const bottom = bounds.maxY * fit.scale + fit.panY
    expect(left).toBeGreaterThanOrEqual(viewport.x + 10 - 1e-9)
    expect(right).toBeLessThanOrEqual(viewport.x + viewport.w - 10 + 1e-9)
    expect(top).toBeGreaterThanOrEqual(viewport.y + 10 - 1e-9)
    expect(bottom).toBeLessThanOrEqual(viewport.y + viewport.h - 10 + 1e-9)
  })

  it('pad {x,y}：水平/垂直内边距分别生效（画报舞台 30/25）', () => {
    const fit = fitModelInto(bounds, viewport, { x: 30, y: 25 }, 1.5, 0.54)
    expect(fit.scale).toBe(Math.min((viewport.w - 60) / 200, (viewport.h - 50) / 200, 1.5))
    // 垂直基准 0.54：模型中心落在视口 54% 高度处
    const centerY = (bounds.minY + bounds.maxY) / 2
    const renderedCenterY = centerY * fit.scale + fit.panY
    expect(renderedCenterY).toBeCloseTo(viewport.y + viewport.h * 0.54, 10)
  })

  it('baseline 0.5 居中；maxScale 生效时仍居中', () => {
    const fit = fitModelInto(bounds, viewport, 0, 0.1, 0.5)
    expect(fit.scale).toBe(0.1)
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    expect(centerX * fit.scale + fit.panX).toBeCloseTo(viewport.x + viewport.w / 2, 10)
    expect(centerY * fit.scale + fit.panY).toBeCloseTo(viewport.y + viewport.h / 2, 10)
  })

  it('零尺寸包围盒不会除零（span 至少按 1 计）', () => {
    const fit = fitModelInto({ minX: 0, maxX: 0, minY: 0, maxY: 0 }, viewport, 6, 1)
    expect(Number.isFinite(fit.scale)).toBe(true)
    expect(fit.scale).toBeGreaterThan(0)
  })
})

describe('modelGroundCenter：地基中心', () => {
  it('取块 x/y 范围的整数中点', () => {
    expect(modelGroundCenter([block(0, 0, 0), block(3, 5, 0)])).toEqual({ cx: 2, cy: 3 })
  })

  it('空模型返回 0/0（不产生 Infinity）', () => {
    expect(modelGroundCenter([])).toEqual({ cx: 0, cy: 0 })
  })
})

describe('paintModel：地基 + 画家排序 + 积木', () => {
  it('先画地基（用 groundBlocks 中心），再按 x+y 深度、z 升序画积木', () => {
    const { ctx } = createTransformContext()
    const blocks = [block(2, 0, 0), block(0, 0, 0), block(0, 0, 1), block(1, 1, 0)]
    paintModel(ctx, { blocks, palette: PALETTE })
    expect(spies.drawGroundBase).toHaveBeenCalledTimes(1)
    // 地基中心按 blocks 计算：(0..2, 0..1) → cx=1, cy=1
    expect(spies.drawGroundBase.mock.calls[0][5]).toBe(1)
    expect(spies.drawGroundBase.mock.calls[0][6]).toBe(1)
    const order = blocks.map((_, index) => cubeArgs(index).sx)
    const expected = [...blocks]
      .sort((a, b) => (a.x + a.y !== b.x + b.y ? a.x + a.y - (b.x + b.y) : a.z - b.z))
      .map((b) => worldToScreen(b.x, b.y, b.z, DEFAULT_ISO_CONFIG).sx)
    expect(order).toEqual(expected)
    expect(spies.drawCube).toHaveBeenCalledTimes(4)
  })

  it('groundBlocks 与 blocks 分离：画报未完成时地基仍按完整蓝图、积木只画已落块', () => {
    const { ctx } = createTransformContext()
    const full = [block(0, 0, 0), block(0, 0, 1), block(0, 0, 2)]
    paintModel(ctx, { blocks: full.slice(0, 1), groundBlocks: full, palette: PALETTE })
    expect(spies.drawGroundBase).toHaveBeenCalledTimes(1)
    expect(spies.drawGroundBase.mock.calls[0][1]).toBe(full)
    expect(spies.drawCube).toHaveBeenCalledTimes(1)
  })

  it('空 blocks：不画积木，但 groundBlocks 非空时仍画地基（未落块空舞台）', () => {
    const { ctx } = createTransformContext()
    paintModel(ctx, { blocks: [], groundBlocks: [block(0, 0, 0)], palette: PALETTE })
    expect(spies.drawGroundBase).toHaveBeenCalledTimes(1)
    expect(spies.drawCube).not.toHaveBeenCalled()
  })

  it('skipGround：剪影态不画虚线地基', () => {
    const { ctx } = createTransformContext()
    paintModel(ctx, { blocks: [block(0, 0, 0)], palette: PALETTE, skipGround: true })
    expect(spies.drawGroundBase).not.toHaveBeenCalled()
  })

  it('noStuds：正上方有块时省略凸点；顶层保留', () => {
    const { ctx } = createTransformContext()
    paintModel(ctx, {
      blocks: [block(0, 0, 0), block(0, 0, 1)],
      palette: PALETTE
    })
    // 排序后先画 z=0 再画 z=1
    expect(cubeArgs(0).options.noStuds).toBe(true)
    expect(cubeArgs(1).options.noStuds).toBe(false)
  })

  it('bonusByIndex 按 blocks 序位映射；缺省时一律 false', () => {
    const { ctx } = createTransformContext()
    paintModel(ctx, {
      blocks: [block(0, 0, 0), block(1, 0, 0)],
      palette: PALETTE,
      bonusByIndex: [false, true]
    })
    expect(cubeArgs(0).options.bonus).toBe(false)
    expect(cubeArgs(1).options.bonus).toBe(true)

    spies.drawCube.mockClear()
    paintModel(ctx, { blocks: [block(0, 0, 0)], palette: PALETTE })
    expect(cubeArgs(0).options.bonus).toBe(false)
  })

  it('spriteScale / ignoreBlockColor 原样下传', () => {
    const { ctx } = createTransformContext()
    paintModel(ctx, {
      blocks: [block(0, 0, 0, { color: '#b45309' })],
      palette: PALETTE,
      spriteScale: 2,
      ignoreBlockColor: true
    })
    expect(cubeArgs(0).options.spriteScale).toBe(2)
    expect(cubeArgs(0).options.color).toBeUndefined()

    spies.drawCube.mockClear()
    paintModel(ctx, {
      blocks: [block(0, 0, 0, { color: '#b45309' })],
      palette: PALETTE,
      spriteScale: 1
    })
    expect(cubeArgs(0).options.spriteScale).toBe(1)
    expect(cubeArgs(0).options.color).toBe('#b45309')
  })
})

describe('paintModelStage：fit + painter 一步到位', () => {
  it('返回 fit，并在 save/restore 之间应用 translate/scale', () => {
    const { ctx, calls } = createTransformContext()
    const blocks = [block(0, 0, 0), block(0, 0, 1)]
    const viewport = { x: 10, y: 20, w: 100, h: 80 }
    const fit = paintModelStage(ctx, {
      blocks,
      palette: PALETTE,
      viewport,
      pad: 6,
      maxScale: 0.7,
      baseline: 0.5
    })
    const expected = fitModelInto(measureModelBounds(blocks), viewport, 6, 0.7, 0.5)
    expect(fit).toEqual(expected)
    expect(calls[0]).toEqual({ name: 'save', args: [] })
    expect(calls[1]).toEqual({ name: 'translate', args: [fit.panX, fit.panY] })
    expect(calls[2]).toEqual({ name: 'scale', args: [fit.scale, fit.scale] })
    expect(calls[calls.length - 1]).toEqual({ name: 'restore', args: [] })
    expect(spies.drawCube).toHaveBeenCalledTimes(2)
  })

  it('boundsBlocks 与 blocks 分离：fit 按完整蓝图、绘制按可见块', () => {
    const { ctx } = createTransformContext()
    const full = [block(0, 0, 0), block(6, 0, 0)]
    const fit = paintModelStage(ctx, {
      blocks: full.slice(0, 1),
      boundsBlocks: full,
      groundBlocks: full,
      palette: PALETTE,
      viewport: { x: 0, y: 0, w: 200, h: 200 },
      pad: 10,
      maxScale: 1
    })
    const expected = fitModelInto(
      measureModelBounds(full),
      { x: 0, y: 0, w: 200, h: 200 },
      10,
      1,
      0.5
    )
    expect(fit).toEqual(expected)
    expect(spies.drawCube).toHaveBeenCalledTimes(1)
  })
})

describe('prepareModelCanvas：dpr 尺寸与变换', () => {
  it('物理尺寸 = 逻辑 × dpr，setTransform + clearRect 各一次', () => {
    const { ctx, calls } = createTransformContext()
    const canvas = document.createElement('canvas')
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation((() => ctx) as unknown as HTMLCanvasElement['getContext'])
    try {
      const returned = prepareModelCanvas(canvas, { width: 132, height: 92, dpr: 2 })
      expect(returned).toBe(ctx)
      expect(canvas.width).toBe(264)
      expect(canvas.height).toBe(184)
      expect(calls).toContainEqual({ name: 'setTransform', args: [2, 0, 0, 2, 0, 0] })
      expect(calls).toContainEqual({ name: 'clearRect', args: [0, 0, 132, 92] })
    } finally {
      getContext.mockRestore()
    }
  })

  it('getContext 返回 null 时返回 null（不抛错）', () => {
    const canvas = document.createElement('canvas')
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation((() => null) as unknown as HTMLCanvasElement['getContext'])
    try {
      expect(prepareModelCanvas(canvas, { width: 10, height: 10, dpr: 1 })).toBeNull()
    } finally {
      getContext.mockRestore()
    }
  })
})
