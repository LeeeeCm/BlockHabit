import { useEffect, useRef, useCallback } from 'react'
import type { Blueprint } from '../types'
import { DEFAULT_ISO_CONFIG, depth, drawCube, paletteFromDocument, worldToScreen } from './iso'

interface Props {
  blueprint: Blueprint
  placedCount: number
  /** 需要播放掉落动画的块序号（新块） */
  animateIndex?: number | null
  onAnimated?: () => void
}

const DROP_MS = 340

/** ease-out-bounce */
function bounce(t: number): number {
  const n1 = 7.5625
  const d1 = 2.75
  if (t < 1 / d1) return n1 * t * t
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
  return n1 * (t -= 2.625 / d1) * t + 0.984375
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

    const anim = animRef.current
    let animZ = 0
    let animating = false
    if (anim) {
      const t = Math.min(1, (performance.now() - anim.start) / DROP_MS)
      animZ = (1 - bounce(t)) * 6
      animating = t < 1
    }

    const cubes = bp.blocks.map((b, i) => ({ b, i })).sort((a, c) => depth(a.b.x, a.b.y, a.b.z) - depth(c.b.x, c.b.y, c.b.z))

    for (const { b, i } of cubes) {
      const placed = i < pc
      if (!placed) continue
      const isNew = anim && ai != null && i === ai && ai === pc - 1
      const z = isNew ? b.z + animZ : b.z
      const { sx, sy } = worldToScreen(b.x, b.y, z, DEFAULT_ISO_CONFIG)
      drawCube(ctx, sx, sy, DEFAULT_ISO_CONFIG, palette, {
        type: b.type,
        ghost: false,
        highlight: Boolean(isNew && animating === false),
      })
    }

    // 未放置的虚影（只画已放置块附近的后续块，避免满屏虚线）
    const ghostFrom = pc
    const ghostTo = Math.min(bp.blocks.length, pc + 60)
    const ghosts = bp.blocks
      .slice(ghostFrom, ghostTo)
      .map((b, k) => ({ b, i: ghostFrom + k }))
      .sort((a, c) => depth(a.b.x, a.b.y, a.b.z) - depth(c.b.x, c.b.y, c.b.z))
    for (const { b } of ghosts) {
      const { sx, sy } = worldToScreen(b.x, b.y, b.z, DEFAULT_ISO_CONFIG)
      drawCube(ctx, sx, sy, DEFAULT_ISO_CONFIG, palette, { type: 'basic', ghost: true })
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (anim && animating) {
      requestAnimationFrame(draw)
    } else if (anim) {
      animRef.current = null
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
