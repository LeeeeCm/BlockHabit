import { useEffect, useRef } from 'react'
import type { Blueprint } from '../types'
import {
  DEFAULT_ISO_CONFIG,
  paletteFromDocument,
  withAlpha,
  worldToScreen,
  type IsoPalette
} from '../render/iso'
import { measureModelBounds, paintModelStage, prepareModelCanvas } from '../render/modelStage'
import { useAppStore } from '../store/appStore'

interface Props {
  blueprint: Blueprint
  width?: number
  height?: number
  /**
   * 只绘制前 N 块（建造中的「当前样子」）。已落块 = 蓝图前 N 块（nextSlot 语义）；
   * 地基与取景仍按完整蓝图，保证构图稳定、缩略图不抖动。
   * 缺省 = 完整蓝图（完成态 / 锁定剪影）。
   */
  placedCount?: number
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
    ink: withAlpha(ink, 0.45)
  }
}

/** 读当前主题 --ink（画布不支持 var()，必须先解析成具体颜色） */
function inkFromDocument(doc: Document = document): string {
  const value = doc.defaultView
    ?.getComputedStyle(doc.documentElement)
    .getPropertyValue('--ink')
    .trim()
  return value || '#0a0a0a'
}

/**
 * 图鉴缩略图：一次性绘制蓝图「完成形态」的等距预览。
 * 使用当前主题调色板（theme 变化时重绘）；锁定态由 silhouette 参数表达（不再整卡压暗）。
 */
export function BlueprintThumb({
  blueprint,
  width = 132,
  height = 92,
  placedCount,
  silhouette = false
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const theme = useAppStore((s) => s.settings.theme)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // dpr 由 prepareModelCanvas 统一处理（缺省 = min(devicePixelRatio, 2)）
    const ctx = prepareModelCanvas(canvas, { width, height })
    if (!ctx) return

    const all = blueprint.blocks
    if (all.length === 0) return
    const placed =
      placedCount === undefined ? all.length : Math.max(0, Math.min(placedCount, all.length))
    const blocks = placed === all.length ? all : all.slice(0, placed)
    // 建造中：只画已落块，但地基仍按完整蓝图；取景 = 完整地基（z=0 足迹）+ 已落块，
    // 既不让桌面级地基被裁掉，也不为「还没建的高度」预留空间。
    const building = placedCount !== undefined && placed < all.length
    const boundsBlocks = building ? [...all.map((b) => ({ ...b, z: 0 })), ...blocks] : all
    // 虚线地基按完整蓝图再外扩 1.5 格：取景必须包含它的投影包围盒，否则转角会被画布裁掉。
    const cfg = DEFAULT_ISO_CONFIG
    const measured = measureModelBounds(boundsBlocks, cfg)
    let gx0 = Infinity
    let gx1 = -Infinity
    let gy0 = Infinity
    let gy1 = -Infinity
    for (const b of all) {
      gx0 = Math.min(gx0, b.x)
      gx1 = Math.max(gx1, b.x)
      gy0 = Math.min(gy0, b.y)
      gy1 = Math.max(gy1, b.y)
    }
    const corners = [
      worldToScreen(gx0 - 1.5, gy0 - 1.5, 0, cfg),
      worldToScreen(gx1 + 1.5, gy0 - 1.5, 0, cfg),
      worldToScreen(gx1 + 1.5, gy1 + 1.5, 0, cfg),
      worldToScreen(gx0 - 1.5, gy1 + 1.5, 0, cfg)
    ]
    const strokePad = 2
    const bounds = {
      minX: Math.min(measured.minX, ...corners.map((c) => c.sx)) - strokePad,
      maxX: Math.max(measured.maxX, ...corners.map((c) => c.sx)) + strokePad,
      minY: Math.min(measured.minY, ...corners.map((c) => c.sy)) - strokePad,
      maxY: Math.max(measured.maxY, ...corners.map((c) => c.sy)) + strokePad
    }

    const palette = silhouette ? silhouettePalette(inkFromDocument()) : paletteFromDocument()
    // fit + 画家排序 + 地基全部复用 modelStage（与画报/相纸/年鉴同一套算法）
    paintModelStage(ctx, {
      blocks,
      groundBlocks: all,
      boundsBlocks,
      bounds,
      palette,
      viewport: { x: 0, y: 0, w: width, h: height },
      pad: 8,
      maxScale: 0.9,
      spriteScale: 2,
      // 剪影态不画虚线地基：只看轮廓，不带「正在建造」的语义；
      // 同时忽略建筑专属配色（否则扩展包的彩色块会泄露出来，剪影变成「灰模里混着彩色块」）。
      skipGround: silhouette,
      ignoreBlockColor: silhouette
    })
  }, [blueprint, theme, width, height, placedCount, silhouette])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        maxWidth: width,
        height: 'auto',
        aspectRatio: `${width} / ${height}`,
        display: 'block',
        margin: '0 auto',
        borderRadius: 'var(--r-sm)',
        background: 'transparent',
        opacity: silhouette ? 0.9 : undefined
      }}
      aria-hidden="true"
    />
  )
}
