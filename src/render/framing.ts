import type { BlockDef } from '../types'
import { STUD_H, worldToScreen, rotateCoord, DEFAULT_ISO_CONFIG } from './iso'

/** 屏幕坐标系下的可见包围盒（与 BuildScene 的取景计算同一口径） */
export interface ViewBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * 取景权重 k（D10）：
 * - k = 0 → 只框住「已放置的积木」→ 开荒期模型铺满画面
 * - k = 1 → 框住整座蓝图（含地基虚线）→ 建成期能看到全貌
 * 中间用 smoothstep 过渡，避免块数增长时相机突跳。
 */
export function framingWeight(placedCount: number, totalBlocks: number): number {
  if (totalBlocks <= 0) return 1
  const t = Math.max(0, Math.min(1, placedCount / totalBlocks))
  const A = 0.25
  const B = 0.6
  if (t <= A) return 0
  if (t >= B) return 1
  const x = (t - A) / (B - A)
  return x * x * (3 - 2 * x)
}

/** 在「已放置块包围盒」与「整蓝图包围盒」之间插值（placed 是 all 的子集，插值结果始终包含 placed） */
export function blendBounds(placed: ViewBounds, all: ViewBounds, k: number): ViewBounds {
  const lerp = (a: number, b: number): number => a + (b - a) * k
  return {
    minX: lerp(placed.minX, all.minX),
    maxX: lerp(placed.maxX, all.maxX),
    minY: lerp(placed.minY, all.minY),
    maxY: lerp(placed.maxY, all.maxY)
  }
}

/**
 * 量取一组积木（+ 地基 0.6 格余量）在屏幕上的包围盒。
 * cx / cy 必须始终来自整座蓝图的中心：旋转轴固定，取景变化时模型不会横向漂移。
 */
export function measureBounds(blocks: BlockDef[], cx: number, cy: number, rot: number): ViewBounds {
  if (blocks.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  const cfg = DEFAULT_ISO_CONFIG
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  // 1) 先求「等距平面坐标」的包围盒（旋转后的网格坐标）
  let minGx = Infinity
  let maxGx = -Infinity
  let minGy = Infinity
  let maxGy = -Infinity
  for (const b of blocks) {
    const { rx, ry } = rotateCoord(b.x, b.y, cx, cy, rot)
    minGx = Math.min(minGx, rx)
    maxGx = Math.max(maxGx, rx)
    minGy = Math.min(minGy, ry)
    maxGy = Math.max(maxGy, ry)
  }
  // 2) 投影每个积木（含块身/凸点高度）到屏幕，累加包围盒
  for (const b of blocks) {
    const { rx, ry } = rotateCoord(b.x, b.y, cx, cy, rot)
    const { sx, sy } = worldToScreen(rx, ry, b.z, cfg)
    minX = Math.min(minX, sx - cfg.tileW / 2)
    maxX = Math.max(maxX, sx + cfg.tileW / 2)
    minY = Math.min(minY, sy - cfg.tileH / 2 - STUD_H)
    maxY = Math.max(maxY, sy + cfg.tileH / 2 + cfg.blockH)
  }
  // 3) 地基范围框四角（在平面坐标上留 0.6 格余量）投影后再并入
  const corners: Array<[number, number]> = [
    [minGx - 0.6, minGy - 0.6],
    [maxGx + 0.6, minGy - 0.6],
    [maxGx + 0.6, maxGy + 0.6],
    [minGx - 0.6, maxGy + 0.6]
  ]
  for (const [gx, gy] of corners) {
    const { sx, sy } = worldToScreen(gx, gy, 0, cfg)
    minX = Math.min(minX, sx - cfg.tileW / 2)
    maxX = Math.max(maxX, sx + cfg.tileW / 2)
    minY = Math.min(minY, sy)
    maxY = Math.max(maxY, sy)
  }
  return { minX, maxX, minY, maxY }
}
