import { useEffect, useRef } from 'react'
import type { Blueprint } from '../types'
import { paletteFromDocument, withAlpha, type IsoPalette } from '../render/iso'
import { paintModelStage, prepareModelCanvas } from '../render/modelStage'
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
  /**
   * 已落块数：传入时只画前 N 块（图鉴「建造中」显示当前形态），
   * 地基仍按完整蓝图铺，避免未完成时整座建筑缩水。
   */
  placedCount?: number
}

/** 缩略图实际绘制的块：建造中只画已落下的前缀，其余画完整蓝图 */
export function thumbBlocks(blueprint: Blueprint, placedCount?: number) {
  if (placedCount === undefined) return blueprint.blocks
  return blueprint.blocks.slice(0, Math.max(0, Math.min(placedCount, blueprint.blocks.length)))
}

/** 未解锁蓝图的单色剪影调色板：所有面/描边都从 --ink 透明度派生，
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

/** 建造中的「计划轮廓」：比剪影更淡，用来提示完整蓝图，但不冒充已落块 */
function ghostPalette(ink: string): IsoPalette {
  return {
    top: withAlpha(ink, 0.1),
    left: withAlpha(ink, 0.08),
    right: withAlpha(ink, 0.06),
    ghost: withAlpha(ink, 0.04),
    line: withAlpha(ink, 0.12),
    accent: withAlpha(ink, 0.1),
    ink: withAlpha(ink, 0.14)
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
  silhouette = false,
  placedCount
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const theme = useAppStore((s) => s.settings.theme)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // dpr 由 prepareModelCanvas 统一处理（缺省 = min(devicePixelRatio, 2)）
    const ctx = prepareModelCanvas(canvas, { width, height })
    if (!ctx) return

    const blocks = thumbBlocks(blueprint, placedCount)
    if (blocks.length === 0 && !silhouette && placedCount === undefined) return

    const ink = inkFromDocument()
    if (placedCount !== undefined && blocks.length < blueprint.blocks.length) {
      // 建造中：先用极淡的完整轮廓提示「将要长成什么」，再把已落块画成实色
      paintModelStage(ctx, {
        blocks: blueprint.blocks,
        palette: ghostPalette(ink),
        viewport: { x: 0, y: 0, w: width, h: height },
        pad: 12,
        maxScale: 0.72,
        spriteScale: 2,
        skipGround: true,
        ignoreBlockColor: true
      })
    }

    const palette = silhouette ? silhouettePalette(ink) : paletteFromDocument()
    // fit + 画家排序 + 地基全部复用 modelStage（与画报/相纸/年鉴同一套算法）
    paintModelStage(ctx, {
      blocks,
      // 地基与包围盒仍按完整蓝图：建造中只显示已落块，但不让舞台跟着缩水
      groundBlocks: blueprint.blocks,
      boundsBlocks: blueprint.blocks,
      palette,
      viewport: { x: 0, y: 0, w: width, h: height },
      pad: 12,
      maxScale: 0.72,
      spriteScale: 2,
      // 剪影态不画虚线地基：只看轮廓，不带「正在建造」的语义；
      // 同时忽略建筑专属配色（否则扩展包的彩色块会泄露出来，剪影变成「灰模里混着彩色块」）。
      skipGround: silhouette,
      ignoreBlockColor: silhouette
    })
  }, [blueprint, theme, width, height, silhouette, placedCount])

  return (
    <div
      className="gallery-thumb"
      style={{
        width,
        height,
        overflow: 'hidden',
        borderRadius: 'var(--r-sm)',
        background: silhouette ? 'transparent' : 'var(--surface)'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width,
          height,
          display: 'block',
          background: 'transparent',
          opacity: silhouette ? 0.9 : undefined
        }}
        aria-hidden="true"
      />
    </div>
  )
}
