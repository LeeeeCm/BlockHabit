import { useEffect, useRef, useCallback } from 'react'
import type { Blueprint } from '../types'
import {
  DEFAULT_ISO_CONFIG,
  depth,
  drawCube,
  drawGroundBounds,
  paletteFromDocument,
  worldToScreen,
} from './iso'

interface Props {
  blueprint: Blueprint
  placedCount: number
  /** 需要播放掉落动画的块序号（新块） */
  animateIndex?: number | null
  onAnimated?: () => void
}

/** 下落总时长：慢落 + 着地压扁回弹 + 小回跳，共 ~1.3s */
const DROP_MS = 1300

const easeInCubic = (t: number) => t * t * t
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t)

/**
 * 动画时间线 p∈[0,1]：
 * 0.00–0.50 重力加速下落（z: 7→0）
 * 0.50–0.62 着地压扁（scaleY 0.78→1, scaleX 1.16→1）
 * 0.62–0.92 回弹一小段再落下（z: sin 弧线衰减）
 * 0.92–1.00 静置微颤收敛
 */
function animState(p: number): { z: number; sx: number; sy: number } {
  if (p < 0.5) {
    const t = easeInCubic(p / 0.5)
    return { z: 7 * (1 - t), sx: 1, sy: 1 }
  }
  if (p < 0.62) {
    const t = easeOutQuad((p - 0.5) / 0.12)
    return { z: 0, sx: 1.16 - 0.16 * t, sy: 0.78 + 0.22 * t }
  }
  if (p < 0.92) {
    const t = (p - 0.62) / 0.3
    return { z: 1.05 * Math.sin(Math.PI * t) * (1 - 0.4 * t), sx: 1, sy: 1 }
  }
  const t = (p - 0.92) / 0.08
  const wob = Math.sin(Math.PI * t * 2) * (1 - t) * 0.045
  return { z: 0, sx: 1 + wob, sy: 1 - wob }
}

export function BuildScene({ blueprint, placedCount, animateIndex, onAnimated }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef({ scale: 1, panX: 0, panY: 0, fitted: false })
  const animRef = useRef<{ index: number; start: number } | null>(null)
  const stateRef = useRef({ blueprint, placedCount, animateIndex })
  stateRef.current = { blueprint, placedCount, animateIndex }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { blueprint: bp, placedCount: pc, animateIndex: ai } = stateRef.current
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const palette = paletteFromDocument()
    const view = viewRef.current
    ctx.translate(view.panX, view.panY)
    ctx.scale(view.scale, view.scale)

    const cfg = DEFAULT_ISO_CONFIG

    // 地基范围：虚线圆角菱形（不画虚影积木）
    drawGroundBounds(ctx, bp.blocks, cfg, palette)

    const anim = animRef.current
    let animating = false
    let a = { z: 0, sx: 1, sy: 1 }
    if (anim) {
      const p = Math.min(1, (performance.now() - anim.start) / DROP_MS)
      a = animState(p)
      animating = p < 1
    }

    // 顶上有方块的格子不画凸点（ studs 被盖住也无妨，但省一点绘制）
    const occupied = new Set(bp.blocks.map((b) => `${b.x},${b.y},${b.z + 1}`))

    const cubes = bp.blocks
      .map((b, i) => ({ b, i }))
      .sort((m, n) => depth(m.b.x, m.b.y, m.b.z) - depth(n.b.x, n.b.y, n.b.z))

    for (const { b, i } of cubes) {
      if (i >= pc) continue
      const isNew = anim && ai != null && i === ai && ai === pc - 1
      const z = isNew ? a.z : 0
      const { sx, sy } = worldToScreen(b.x, b.y, z, cfg)

      if (isNew && (a.sx !== 1 || a.sy !== 1)) {
        // 以立方体底顶点为轴做压扁/回弹
        ctx.save()
        ctx.translate(sx, sy + cfg.tileH / 2 + cfg.blockH - z * cfg.blockH)
        ctx.scale(a.sx, a.sy)
        drawCube(ctx, 0, -(cfg.tileH / 2 + cfg.blockH), cfg, palette, {
          type: b.type,
          noStuds: occupied.has(`${b.x},${b.y},${b.z}`),
        })
        ctx.restore()
      } else {
        drawCube(ctx, sx, sy, cfg, palette, {
          type: b.type,
          noStuds: occupied.has(`${b.x},${b.y},${b.z}`),
          highlight: Boolean(isNew && !animating),
        })
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (anim && animating) {
      requestAnimationFrame(draw)
    } else if (anim) {
      animRef.current = null
      draw() // 最后一帧带高亮
      onAnimated?.()
    }
  }, [onAnimated])

  // 尺寸初始化 + 自适应居中
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      if (!viewRef.current.fitted) fitView()
      draw()
    }
    const fitView = () => {
      const bp = stateRef.current.blueprint
      const xs: number[] = []
      const ys: number[] = []
      for (const b of bp.blocks) {
        const { sx, sy } = worldToScreen(b.x, b.y, b.z, DEFAULT_ISO_CONFIG)
        xs.push(sx + DEFAULT_ISO_CONFIG.tileW / 2, sx - DEFAULT_ISO_CONFIG.tileW / 2)
        ys.push(sy + DEFAULT_ISO_CONFIG.tileH / 2 + DEFAULT_ISO_CONFIG.blockH, sy - DEFAULT_ISO_CONFIG.tileH / 2)
      }
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const scale = Math.min((w - 80) / (maxX - minX), (h - 80) / (maxY - minY), 2)
      viewRef.current = {
        scale,
        panX: w / 2 - ((minX + maxX) / 2) * scale,
        panY: h / 2 - ((minY + maxY) / 2) * scale,
        fitted: true,
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [draw])

  // 状态变化重绘；新块触发掉落动画
  useEffect(() => {
    if (animateIndex != null && animateIndex === placedCount - 1 && placedCount > 0) {
      animRef.current = { index: animateIndex, start: performance.now() }
    }
    draw()
  }, [placedCount, animateIndex, draw])

  // 交互：拖拽平移 / 滚轮缩放
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let dragging = false
    let lastX = 0
    let lastY = 0

    const onDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const view = viewRef.current
      view.panX += e.clientX - lastX
      view.panY += e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      draw()
    }
    const onUp = () => (dragging = false)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const view = viewRef.current
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      const next = Math.min(3, Math.max(0.3, view.scale * factor))
      view.panX = mx - ((mx - view.panX) / view.scale) * next
      view.panY = my - ((my - view.panY) / view.scale) * next
      view.scale = next
      draw()
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [draw])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
}
