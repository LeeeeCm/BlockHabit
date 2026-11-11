import { describe, expect, it } from 'vitest'
import {
  BLOCK_T,
  CASCADE_FALL_FRAC,
  animState,
  cascadeState,
  jelly,
  planCascade,
} from './sceneMotion'

/**
 * D-20261110-044：建造场景的动画时间线（E5 拆分自 BuildScene.tsx）。
 * 断言的是**时间线性质**（落点在 0、回弹收敛、级联逐层延后），不是具体像素。
 */
describe('animState（新块慢落）', () => {
  it('起点在高处、终点落位且无形变', () => {
    expect(animState(0)).toEqual({ z: 7, sx: 1, sy: 1 })
    expect(animState(1)).toEqual({ z: 0, sx: 1, sy: 1 })
  })

  it('下落阶段高度单调递减', () => {
    const samples = [0, 0.1, 0.2, 0.3, 0.4].map((p) => animState(p).z)
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeLessThan(samples[i - 1])
  })

  it('果冻阶段（p>0.42）有形变，且挤压/拉伸方向相反（守体积）', () => {
    // 0.55 处已越过第一次挤压、进入反向拉伸，所以不能假设固定方向；只断言「有变形且方向相反」
    const s = animState(0.55)
    expect(s.sx).not.toBe(1)
    expect(Math.sign(s.sx - 1)).toBe(-Math.sign(s.sy - 1))
  })
})

describe('jelly', () => {
  it('落地瞬间（t=0）最扁：压 Y 胀 X；结束时（t=1）收敛为无形变', () => {
    const land = jelly(0)
    expect(land.z).toBe(0)
    expect(land.sy).toBeLessThan(1)
    expect(land.sx).toBeGreaterThan(1)
    expect(land.sx - 1).toBeCloseTo(-(land.sy - 1) * 0.85, 10) // 压缩量与膨胀量的既定比例
    expect(jelly(1)).toMatchObject({ sx: 1, sy: 1 })
  })

  it('全程无 NaN、形变幅度受限（不会视觉爆炸）', () => {
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const j = jelly(t)
      expect(Number.isFinite(j.z)).toBe(true)
      expect(Math.abs(j.sx)).toBeLessThan(1.6)
      expect(Math.abs(j.sy)).toBeLessThan(1.6)
    }
  })
})

describe('cascadeState（级联单块）', () => {
  it('起点在高处，结束后 done 且无形变', () => {
    expect(cascadeState(0)).toMatchObject({ z: 4.5, sx: 1, sy: 1, done: false })
    expect(cascadeState(BLOCK_T)).toMatchObject({ z: 0, sx: 1, sy: 1, done: true })
  })

  it('超过时长后保持落位（不反复）', () => {
    expect(cascadeState(BLOCK_T * 3)).toMatchObject({ z: 0, done: true })
  })

  it('下落阶段高度单调递减', () => {
    const a = cascadeState(BLOCK_T * CASCADE_FALL_FRAC * 0.3).z
    const b = cascadeState(BLOCK_T * CASCADE_FALL_FRAC * 0.7).z
    expect(b).toBeLessThan(a)
  })
})

describe('planCascade（逐层级联规划）', () => {
  it('第一块从 0 开始，总时长 = 最后一块起点 + 单块时长', () => {
    const plan = planCascade([{ z: 0 }, { z: 0 }, { z: 1 }], 3)
    expect(plan.starts[0]).toBe(0)
    expect(plan.total).toBe(plan.starts[2] + BLOCK_T)
  })

  it('同层积木同时下落（LAYER_STAGGER = 0）', () => {
    const plan = planCascade([{ z: 0 }, { z: 0 }], 2)
    expect(plan.starts[0]).toBe(plan.starts[1])
  })

  it('上一层晚于下一层（逐层咬合）', () => {
    const plan = planCascade([{ z: 0 }, { z: 1 }], 2)
    expect(plan.starts[1]).toBeGreaterThan(plan.starts[0])
  })

  it('starts 单调不减，且 count 决定长度', () => {
    const plan = planCascade([{ z: 0 }, { z: 0 }, { z: 1 }, { z: 2 }], 4)
    expect(plan.starts).toHaveLength(4)
    for (let i = 1; i < plan.starts.length; i++) expect(plan.starts[i]).toBeGreaterThanOrEqual(plan.starts[i - 1])
  })
})
