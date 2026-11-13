import type { Blueprint } from '../types'
import { blueprints } from '../logic/blueprints'
import {
  DEFAULT_ISO_CONFIG,
  STUD_H,
  drawCube,
  drawGroundBase,
  worldToScreen,
  type IsoConfig,
  type IsoPalette
} from './iso'

/**
 * A4 档案包建筑图（D-20261110-062）：离屏渲染「已落成建筑」的等距照片。
 *
 * 约定：
 * - **透明背景**（不画纸底），导出 PNG 可放在任意背景上阅读；
 * - **固定 2×**（逻辑 320 → 物理 640），固定取景（同一 fit 算法/边距，不同建筑只差模型本身）；
 * - 调色板固定为纸白主题令牌快照，不随当前主题变化：档案要十年后仍可读，
 *   不应因为导出时用的是暗色主题而变成一块黑图。只用既有 --block-* 令牌值，不引入新色相；
 * - 无文字，因此不依赖 document.fonts。
 */

/** 建筑图逻辑边长（物理 = ×2） */
export const ARCHIVE_BUILDING_SIZE = 320
/** 导出固定 DPR */
export const ARCHIVE_BUILDING_DPR = 2

/** 固定调色板：纸白主题令牌值（top/left/right/ghost/line/accent/ink） */
export const ARCHIVE_BUILDING_PALETTE: IsoPalette = {
  top: '#f4f4f4',
  left: '#c9c9c9',
  right: '#8a8a8a',
  ghost: '#dcdcdc',
  line: '#e8e8e8',
  accent: '#f5b301',
  ink: '#0a0a0a'
}

export interface CanvasBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/** 屏幕空间包围盒（含凸点顶部与块体底部），与图鉴/画报一致 */
export function measureBlueprintBounds(
  blueprint: Blueprint,
  cfg: IsoConfig = DEFAULT_ISO_CONFIG
): CanvasBounds {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const block of blueprint.blocks) {
    const { sx, sy } = worldToScreen(block.x, block.y, block.z, cfg)
    minX = Math.min(minX, sx - cfg.tileW / 2)
    maxX = Math.max(maxX, sx + cfg.tileW / 2)
    minY = Math.min(minY, sy - cfg.tileH / 2 - STUD_H)
    maxY = Math.max(maxY, sy + cfg.tileH / 2 + cfg.blockH)
  }
  return { minX, maxX, minY, maxY }
}

/** 把建筑画进一个正方形视口（透明底，居中，固定边距与最大缩放） */
export function paintBlueprintToContext(
  ctx: CanvasRenderingContext2D,
  blueprint: Blueprint,
  size: number,
  palette: IsoPalette = ARCHIVE_BUILDING_PALETTE,
  cfg: IsoConfig = DEFAULT_ISO_CONFIG
): void {
  const blocks = blueprint.blocks
  if (blocks.length === 0) return
  const bounds = measureBlueprintBounds(blueprint, cfg)
  const pad = Math.max(12, Math.round(size * 0.06))
  const spanX = Math.max(1, bounds.maxX - bounds.minX)
  const spanY = Math.max(1, bounds.maxY - bounds.minY)
  const scale = Math.min((size - pad * 2) / spanX, (size - pad * 2) / spanY, 1.4)
  const panX = size / 2 - ((bounds.minX + bounds.maxX) / 2) * scale
  const panY = size / 2 - ((bounds.minY + bounds.maxY) / 2) * scale

  ctx.save()
  ctx.translate(panX, panY)
  ctx.scale(scale, scale)

  const minBx = Math.min(...blocks.map((block) => block.x))
  const maxBx = Math.max(...blocks.map((block) => block.x))
  const minBy = Math.min(...blocks.map((block) => block.y))
  const maxBy = Math.max(...blocks.map((block) => block.y))
  const centerX = Math.round((minBx + maxBx) / 2)
  const centerY = Math.round((minBy + maxBy) / 2)
  drawGroundBase(ctx, blocks, cfg, palette, 0, centerX, centerY)

  // 画家排序：按 x+y（深度）再按 z，被上层块遮挡的面自动覆盖
  const cubes = [...blocks].sort((a, b) => {
    const sumA = a.x + a.y
    const sumB = b.x + b.y
    if (sumA !== sumB) return sumA - sumB
    return a.z - b.z
  })
  const indexAt = new Map<string, number>()
  blocks.forEach((block, index) => indexAt.set(`${block.x},${block.y},${block.z}`, index))
  for (const block of cubes) {
    const above = indexAt.get(`${block.x},${block.y},${block.z + 1}`)
    const { sx, sy } = worldToScreen(block.x, block.y, block.z, cfg)
    drawCube(ctx, sx, sy, cfg, palette, {
      spriteScale: ARCHIVE_BUILDING_DPR,
      type: block.type,
      color: block.color,
      noStuds: above !== undefined
    })
  }
  ctx.restore()
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null)
      return
    }
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    } catch {
      resolve(null)
    }
  })
}

/**
 * 渲染单座已落成建筑的透明 PNG（物理 640×640）；无法渲染时返回 null（不阻塞导出）。
 * 浏览器/WebView 下用离屏 canvas；jsdom（无 2D context）返回 null。
 */
export async function renderBuildingPng(
  blueprintId: string,
  size: number = ARCHIVE_BUILDING_SIZE
): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null
  const blueprint = blueprints[blueprintId]
  if (!blueprint || blueprint.blocks.length === 0) return null
  const canvas = document.createElement('canvas')
  canvas.width = size * ARCHIVE_BUILDING_DPR
  canvas.height = size * ARCHIVE_BUILDING_DPR
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(ARCHIVE_BUILDING_DPR, 0, 0, ARCHIVE_BUILDING_DPR, 0, 0)
  ctx.clearRect(0, 0, size, size)
  paintBlueprintToContext(ctx, blueprint, size)
  const blob = await canvasToPngBlob(canvas)
  if (!blob) return null
  try {
    return new Uint8Array(await blob.arrayBuffer())
  } catch {
    return null
  }
}
