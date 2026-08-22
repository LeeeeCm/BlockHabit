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

/** 新块下落：慢落 + 压扁回弹，共 ~1.3s */
const DROP_MS = 1300
/** 级联铺设时每块的快速下落时长 */
const CASCADE_MS = 220
/** 级联太频繁会烦：15s 内重复进入建造页不再重播 */
const CASCADE_COOLDOWN = 15000

const easeInCubic = (t: number) => t * t * t
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * 新块动画时间线 p∈[0,1]：
 * 0.00–0.50 重力加速下落（z: 7→0）
 * 0.50–0.62 着地压扁（scaleY 0.78→1, scaleX 1.16→1）
 * 0.62–0.92 回弹一小段再落下
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

interface CascadePlan {
  start: number
  cadence: number
  /** 每块的启动时刻（ms，相对 start） */
  starts: number[]
}

/** 逐层级联计划：上层的第一块必须等下层全部落地（层内可并行错峰） */
function planCascade(blocks: Array<{ z: number }>, count: number): CascadePlan {
  const cadence = Math.min(90, Math.max(28, Math.round(4200 / Math.max(1, count))))
  const starts: number[] = []
  let layerStart = 0
  let layerMaxZ = blocks[0]?.z ?? 0
  let layerEnd = 0
  for (let i = 0; i < count; i++) {
    const z = blocks[i].z
    if (z !== layerMaxZ) {
      // 新的一层：从上一层全部落地之后开始
      layerStart = layerEnd
      layerMaxZ = z
    }
    const s = layerStart + (i > 0 && blocks[i - 1].z === z ? cadence : 0)
    starts.push(s)
    layerEnd = Math.max(layerEnd, s + CASCADE_MS)
  }
  return { start: performance.now(), cadence, starts }
}

let lastCascadeAt = 0

export function BuildScene({ blueprint, placedCount, animateIndex, onAnimated }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef({ scale: 1, panX: 0, panY: 0, fitted: false })
  const animRef = useRef<{ index: number; start: number } | null>(null)
  const cascadeRef = useRef<CascadePlan | null>(null)
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
    drawGroundBounds(ctx, bp.blocks, cfg, palette)

    const now = performance.now()
    const anim = animRef.current
    const cascade = cascadeRef.current
    let animating = false
    let a = { z: 0, sx: 1, sy: 1 }
    if (anim) {
      const p = Math.min(1, (now - anim.start) / DROP_MS)
      a = animState(p)
      animating = p < 1
    }

    const occupied = new Set(bp.blocks.map((b) => `${b.x},${b.y},${b.z + 1}`))
    const cubes = bp.blocks
      .map((b, i) => ({ b, i }))
      .sort((m, n) => depth(m.b.x, m.b.y, m.b.z) - depth(n.b.x, n.b.y, n.b.z))

    let cascadeRunning = false
    for (const { b, i } of cubes) {
      if (i >= pc) continue

      // 级联铺设：块尚未「启动」则不画，启动后快速落下
      if (cascade && !(anim && ai === i)) {
        const s = cascade.starts[i]
        const el = now - cascade.start - s
        if (el < 0) continue
        if (el < CASCADE_MS && cascade.starts[i] > 0) {
          const cz = 5 * (1 - easeOutCubic(el / CASCADE_MS))
          const { sx, sy } = worldToScreen(b.x, b.y, cz, cfg)
          drawCube(ctx, sx, sy, cfg, palette, {
            type: b.type,
            noStuds: occupied.has(`${b.x},${b.y},${b.z}`),
          })
          cascadeRunning = true
          continue
        }
      }

      const isNew = anim && ai != null && i === ai && ai === pc - 1
      const z = isNew ? a.z : 0
      const { sx, sy } = worldToScreen(b.x, b.y, z, cfg)

      if (isNew && (a.sx !== 1 || a.sy !== 1)) {
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

    if (cascade) {
      cascadeRunning =
        cascadeRunning || now - cascade.start < cascade.starts[Math.min(pc, cascade.starts.length) - 1] + CASCADE_MS
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (anim && animating) {
      requestAnimationFrame(draw)
    } else if (anim) {
      animRef.current = null
      draw()
      onAnimated?.()
    } else if (cascadeRunning) {
      requestAnimationFrame(draw)
    } else if (cascade) {
      cascadeRef.current = null
      lastCascadeAt = Date.now()
      draw()
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

  // 状态变化重绘：新块 → 慢落动画；否则进场 → 逐层级联（带冷却）
  useEffect(() => {
    if (animateIndex != null && animateIndex === placedCount - 1 && placedCount > 0) {
      cascadeRef.current = null
      animRef.current = { index: animateIndex, start: performance.now() }
    } else if (
      placedCount > 0 &&
      !animRef.current &&
      Date.now() - lastCascadeAt > CASCADE_COOLDOWN
    ) {
      cascadeRef.current = planCascade(stateRef.current.blueprint.blocks, placedCount)
    }
    draw()
  }, [placedCount, animateIndex, draw])

  // 交互：拖拽平移 / 滚轮缩放（点击可跳过级联）
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
