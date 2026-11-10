import { useEffect, useRef } from 'react'
import type { Blueprint } from '../types'
import {
  DEFAULT_ISO_CONFIG,
  drawCube,
  drawGroundBase,
  paletteFromDocument,
  STUD_H,
  withAlpha,
  worldToScreen,
  type IsoPalette,
} from '../render/iso'
import { useAppStore } from '../store/appStore'

interface Props {
  blueprint: Blueprint
  width?: number
  height?: number
  /**
   * 剪影态（B1）：未解锁的扩展包蓝图只显示单色剪影 + 可读名字，
   * 不提前泄露配色与细节；颜色只用 --ink 派生（四主题自动成立），无新色相。
   */
  silhouette?: boolean
}

/**
 * 未解锁蓝图的单色剪影调色板：所有面/描边都从 --ink 透明度派生，
 * 保持等距体积可辨认，但不泄露建筑配色（A1 色相纪律）。
 */
export function silhouettePalette(ink: string): IsoPalette {
  return {
    top: withAlpha(ink, 0.26),
    left: withAlpha(ink, 0.22),
    right: withAlpha(ink, 0.18),
    ghost: withAlpha(ink, 0.08),
    line: withAlpha(ink, 0.3),
    accent: withAlpha(ink, 0.26),
    ink: withAlpha(ink, 0.45),
  }
}

/** 读当前主题 --ink（画布不支持 var()，必须先解析成具体颜色） */
function inkFromDocument(doc: Document = document): string {
  const value = doc.defaultView?.getComputedStyle(doc.documentElement).getPropertyValue('--ink').trim()
  return value || '#0a0a0a'
}

/**
 * 图鉴缩略图：一次性绘制蓝图「完成形态」的等距预览。
 * 使用当前主题调色板（theme 变化时重绘）；锁定态由 silhouette 参数表达（不再整卡压暗）。
 */
export function BlueprintThumb({ blueprint, width = 132, height = 92, silhouette = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const theme = useAppStore((s) => s.settings.theme)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const palette = silhouette ? silhouettePalette(inkFromDocument()) : paletteFromDocument()
    const cfg = DEFAULT_ISO_CONFIG
    const blocks = blueprint.blocks

    // 屏幕空间包围盒（含凸点顶部与块体底部），fit 进画布并居中
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const b of blocks) {
      const { sx, sy } = worldToScreen(b.x, b.y, b.z, cfg)
      minX = Math.min(minX, sx - cfg.tileW / 2)
      maxX = Math.max(maxX, sx + cfg.tileW / 2)
      minY = Math.min(minY, sy - cfg.tileH / 2 - STUD_H)
      maxY = Math.max(maxY, sy + cfg.tileH / 2 + cfg.blockH)
    }
    if (blocks.length === 0) return
    const pad = 8
    const scale = Math.min(
      (width - pad * 2) / Math.max(1, maxX - minX),
      (height - pad * 2) / Math.max(1, maxY - minY),
      0.9,
    )
    const panX = width / 2 - ((minX + maxX) / 2) * scale
    const panY = height / 2 - ((minY + maxY) / 2) * scale
    ctx.translate(panX, panY)
    ctx.scale(scale, scale)

    const minBx = Math.min(...blocks.map((b) => b.x))
    const maxBx = Math.max(...blocks.map((b) => b.x))
    const minBy = Math.min(...blocks.map((b) => b.y))
    const maxBy = Math.max(...blocks.map((b) => b.y))
    const cx = Math.round((minBx + maxBx) / 2)
    const cy = Math.round((minBy + maxBy) / 2)

    // 剪影态不画虚线地基：只看轮廓，不带「正在建造」的语义
    if (!silhouette) drawGroundBase(ctx, blocks, cfg, palette, 0, cx, cy)

    // 画家算法：按 x+y（深度）再按 z 排序，被上层块遮挡的面自动覆盖
    const cubes = blocks
      .map((b) => b)
      .sort((m, n) => {
        const a = m.x + m.y
        const c = n.x + n.y
        if (a !== c) return a - c
        return m.z - n.z
      })
    const indexAt = new Map<string, number>()
    blocks.forEach((b, i) => indexAt.set(`${b.x},${b.y},${b.z}`, i))

    for (const b of cubes) {
      const aboveIdx = indexAt.get(`${b.x},${b.y},${b.z + 1}`)
      const { sx: px, sy: py } = worldToScreen(b.x, b.y, b.z, cfg)
      drawCube(ctx, px, py, cfg, palette, {
        spriteScale: 2,
        type: b.type,
        // 剪影态必须忽略建筑专属配色（drawCube 会按 b.color 派生三面明暗，
        // 否则扩展包的彩色块会泄露出来，剪影变成「灰模里混着彩色块」）。
        color: silhouette ? undefined : b.color,
        noStuds: aboveIdx !== undefined,
      })
    }
  }, [blueprint, theme, width, height, silhouette])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        display: 'block',
        borderRadius: 'var(--r-sm)',
        background: silhouette ? 'transparent' : 'var(--surface)',
        opacity: silhouette ? 0.9 : undefined,
      }}
      aria-hidden="true"
    />
  )
}
