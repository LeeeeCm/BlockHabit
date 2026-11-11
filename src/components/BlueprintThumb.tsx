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
    // dpr 由 prepareModelCanvas 统一处理（缺省 = min(devicePixelRatio, 2)）
    const ctx = prepareModelCanvas(canvas, { width, height })
    if (!ctx) return

    const blocks = blueprint.blocks
    if (blocks.length === 0) return

    const palette = silhouette ? silhouettePalette(inkFromDocument()) : paletteFromDocument()
    // fit + 画家排序 + 地基全部复用 modelStage（与画报/相纸/年鉴同一套算法）
    paintModelStage(ctx, {
      blocks,
      palette,
      viewport: { x: 0, y: 0, w: width, h: height },
      pad: 8,
      maxScale: 0.9,
      spriteScale: 2,
      // 剪影态不画虚线地基：只看轮廓，不带「正在建造」的语义；
      // 同时忽略建筑专属配色（否则扩展包的彩色块会泄露出来，剪影变成「灰模里混着彩色块」）。
      skipGround: silhouette,
      ignoreBlockColor: silhouette,
    })
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
