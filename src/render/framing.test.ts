import { describe, it, expect } from 'vitest'
import { blendBounds, framingWeight, measureBounds, type ViewBounds } from './framing'
import { getBlueprint } from '../logic/blueprints'

/**
 * D10：建造页取景。
 * 旧实现一律按「整座蓝图」取景 → 3/190 块时模型只占画面 30–45%，第一块积木毫无存在感。
 * 新实现：开荒期只框已放置块，随进度 smoothstep 过渡到整座蓝图。
 */
describe('framingWeight', () => {
  it('开荒期（≤25% 进度）权重为 0：只框已放置块', () => {
    expect(framingWeight(0, 190)).toBe(0)
    expect(framingWeight(3, 190)).toBe(0)
    expect(framingWeight(47, 190)).toBe(0)
  })

  it('建成期（≥60% 进度）权重为 1：框整座蓝图', () => {
    expect(framingWeight(114, 190)).toBe(1)
    expect(framingWeight(190, 190)).toBe(1)
  })

  it('过渡区单调递增，且在 0..1 之间', () => {
    const samples = [0.26, 0.3, 0.4, 0.5, 0.59].map((r) => framingWeight(Math.round(r * 190), 190))
    for (let i = 1; i < samples.length; i++)
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1])
    for (const v of samples) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('空蓝图不除零', () => {
    expect(framingWeight(0, 0)).toBe(1)
  })
})

describe('blendBounds', () => {
  const placed: ViewBounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 }
  const all: ViewBounds = { minX: -50, maxX: 60, minY: -40, maxY: 70 }

  it('k=0 时等于已放置块包围盒', () => {
    expect(blendBounds(placed, all, 0)).toEqual(placed)
  })

  it('k=1 时等于整蓝图包围盒', () => {
    expect(blendBounds(placed, all, 1)).toEqual(all)
  })

  it('中间值既不小于 placed 也不大于 all（始终包含已放置块）', () => {
    const mid = blendBounds(placed, all, 0.5)
    expect(mid.minX).toBeLessThanOrEqual(placed.minX)
    expect(mid.maxX).toBeGreaterThanOrEqual(placed.maxX)
    expect(mid.minY).toBeLessThanOrEqual(placed.minY)
    expect(mid.maxY).toBeGreaterThanOrEqual(placed.maxY)
    expect(mid.minX).toBeGreaterThanOrEqual(all.minX)
    expect(mid.maxX).toBeLessThanOrEqual(all.maxX)
  })
})

describe('measureBounds', () => {
  const bp = getBlueprint('castle')

  it('已放置子集的包围盒始终落在整蓝图包围盒内', () => {
    const cx = 4
    const cy = 4
    const all = measureBounds(bp.blocks, cx, cy, 0)
    const placed = measureBounds(bp.blocks.slice(0, 3), cx, cy, 0)
    expect(placed.minX).toBeGreaterThanOrEqual(all.minX)
    expect(placed.maxX).toBeLessThanOrEqual(all.maxX)
    expect(placed.minY).toBeGreaterThanOrEqual(all.minY)
    expect(placed.maxY).toBeLessThanOrEqual(all.maxY)
  })

  it('数据越少包围盒越小（这正是取景放大的来源）', () => {
    const cx = 4
    const cy = 4
    const area = (b: ViewBounds): number => (b.maxX - b.minX) * (b.maxY - b.minY)
    const three = measureBounds(bp.blocks.slice(0, 3), cx, cy, 0)
    const all = measureBounds(bp.blocks, cx, cy, 0)
    expect(area(three)).toBeLessThan(area(all))
  })

  it('空集合返回零包围盒，不产生 NaN', () => {
    expect(measureBounds([], 0, 0, 0)).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 })
  })
})
