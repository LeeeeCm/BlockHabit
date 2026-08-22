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

/** 新块下落总时长：慢落 + 果冻回弹 */
const DROP_MS = 1350
const DROP_FALL_FRAC = 0.42

/** 级联时每块的总时长（快落 + 果冻） */
const BLOCK_T = 640
const CASCADE_FALL_FRAC = 0.53
/** 层内微错峰 */
const LAYER_STAGGER = 14
/** 下一层在前一层落地、回弹进行到该比例后开始下落 */
const LAYER_OVERLAP = 0.55

const easeInCubic = (t: number) => t * t * t

/**
 * 果冻回弹（挤压拉伸守体积：压 Y 时胀 X）：
 * t=0 最扁 → 回弹拉高 → 衰减振荡，伴随一次小跳
 */
function jelly(t: number): { z: number; sx: number; sy: number } {
  const w = -0.34 * Math.cos(t * Math.PI * 3) * (1 - t)
  const hop = 0.55 * Math.max(0, Math.sin(Math.PI * t * 2)) * (1 - t)
  return { z: hop, sx: 1 - w * 0.85, sy: 1 + w }
}

/** 新块动画时间线：加速下落 → 果冻 */
function animState(p: number): { z: number; sx: number; sy: number } {
  if (p < DROP_FALL_FRAC) {
    const t = easeInCubic(p / DROP_FALL_FRAC)
    return { z: 7 * (1 - t), sx: 1, sy: 1 }
  }
  return jelly((p - DROP_FALL_FRAC) / (1 - DROP_FALL_FRAC))
}

/** 级联单块时间线（更快更硬朗的果冻） */
function cascadeState(elapsed: number): { z: number; sx: number; sy: number; done: boolean } {
  const e = elapsed / BLOCK_T
  if (e >= 1) return { z: 0, sx: 1, sy: 1, done: true }
  if (e < CASCADE_FALL_FRAC) {
    const t = easeInCubic(e / CASCADE_FALL_FRAC)
    return { z: 4.5 * (1 - t), sx: 1, sy: 1, done: false }
  }
  const j = jelly((e - CASCADE_FALL_FRAC) / (1 - CASCADE_FALL_FRAC))
  return { ...j, done: false }
}

interface CascadePlan {
  start: number
  starts: number[]
  total: number
}

/** 逐层级联：底层先落，回弹过半后上一层再落（层内微错峰，落在已就位的下层上） */
function planCascade(blocks: Array<{ z: number }>, count: number): CascadePlan {
  const fall = BLOCK_T * CASCADE_FALL_FRAC
  const jellyDur = BLOCK_T * (1 - CASCADE_FALL_FRAC)
  const starts: number[] = []
  let layerStart = 0
  let layerZ = blocks[0]?.z ?? 0
  let idxInLayer = 0
  for (let i = 0; i < count; i++) {
    const z = blocks[i].z
    if (z !== layerZ) {
      layerStart += fall + jellyDur * LAYER_OVERLAP
      layerZ = z
      idxInLayer = 0
    }
    starts.push(layerStart + idxInLayer * LAYER_STAGGER)
    idxInLayer++
  }
  const total = (starts[count - 1] ?? 0) + BLOCK_T
  return { start: performance.now(), starts, total }
}

export function BuildScene({ blueprint, placedCount, animateIndex, onAnimated }: Props) {  const canvasRef = useRef<HTMLCanvasElement>(null)
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
      const isNew = anim && ai != null && i === ai && ai === pc - 1

      // 级联铺设：逐层落下 + 果冻回弹
      if (cascade && !isNew) {
        const el = now - cascade.start - cascade.starts[i]
        if (el < 0) continue
        const st = cascadeState(el)
        if (!st.done) {
          cascadeRunning = true
          const { sx: cx } = worldToScreen(b.x, b.y, 0, cfg)
          const syBase = worldToScreen(b.x, b.y, 0, cfg).sy
          if (st.sx !== 1 || st.sy !== 1) {
            ctx.save()
            ctx.translate(cx, syBase + cfg.tileH / 2 + cfg.blockH - st.z * cfg.blockH)
            ctx.scale(st.sx, st.sy)
            drawCube(ctx, 0, -(cfg.tileH / 2 + cfg.blockH), cfg, palette, {
              type: b.type,
              noStuds: occupied.has(`${b.x},${b.y},${b.z}`),
            })
            ctx.restore()
          } else {
            const { sx: px, sy: py } = worldToScreen(b.x, b.y, st.z, cfg)
            drawCube(ctx, px, py, cfg, palette, {
              type: b.type,
              noStuds: occupied.has(`${b.x},${b.y},${b.z}`),
            })
          }
          continue
        }
      }

      const z = isNew ? a.z : 0
      const { sx: px, sy: py } = worldToScreen(b.x, b.y, z, cfg)

      if (isNew && (a.sx !== 1 || a.sy !== 1)) {
        ctx.save()
        ctx.translate(px, py + cfg.tileH / 2 + cfg.blockH - z * cfg.blockH)
        ctx.scale(a.sx, a.sy)
        drawCube(ctx, 0, -(cfg.tileH / 2 + cfg.blockH), cfg, palette, {
          type: b.type,
          noStuds: occupied.has(`${b.x},${b.y},${b.z}`),
        })
        ctx.restore()
      } else {
        drawCube(ctx, px, py, cfg, palette, {
          type: b.type,
          noStuds: occupied.has(`${b.x},${b.y},${b.z}`),
          highlight: Boolean(isNew && !animating),
        })
      }
    }

    if (cascade) {
      cascadeRunning = cascadeRunning || now - cascade.start < cascade.total
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
      draw()
    }
  }, [onAnimated])

  // 尺寸初始化 + 自适应居中（把地面虚线范围框完整纳入视野，避免越界）
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
      const cfg = DEFAULT_ISO_CONFIG
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const b of bp.blocks) {
        minX = Math.min(minX, b.x)
        maxX = Math.max(maxX, b.x)
        minY = Math.min(minY, b.y)
        maxY = Math.max(maxY, b.y)
      }
      // 地基范围框四角（含 0.6 格余量）必须完整可见
      const corners: Array<[number, number]> = [
        [minX - 0.6, minY - 0.6],
        [maxX + 0.6, minY - 0.6],
        [maxX + 0.6, maxY + 0.6],
        [minX - 0.6, maxY + 0.6],
      ]
      const xs: number[] = []
      const ys: number[] = []
      for (const b of bp.blocks) {
        const { sx, sy } = worldToScreen(b.x, b.y, b.z, cfg)
        xs.push(sx + cfg.tileW / 2, sx - cfg.tileW / 2)
        ys.push(sy + cfg.tileH / 2 + cfg.blockH, sy - cfg.tileH / 2)
      }
      for (const [x, y] of corners) {
        const { sx, sy } = worldToScreen(x, y, 0, cfg)
        xs.push(sx + cfg.tileW / 2, sx - cfg.tileW / 2)
        ys.push(sy)
      }
      const boundsMinX = Math.min(...xs)
      const boundsMaxX = Math.max(...xs)
      const boundsMinY = Math.min(...ys)
      const boundsMaxY = Math.max(...ys)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const PAD = 48
      const scale = Math.min(
        (w - PAD * 2) / (boundsMaxX - boundsMinX),
        (h - PAD * 2) / (boundsMaxY - boundsMinY),
        2,
      )
      viewRef.current = {
        scale,
        panX: w / 2 - ((boundsMinX + boundsMaxX) / 2) * scale,
        panY: h / 2 - ((boundsMinY + boundsMaxY) / 2) * scale,
        fitted: true,
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [draw])

  // 状态变化重绘：新块 → 慢落果冻；每次进入建造页 → 逐层级联
  useEffect(() => {
    if (animateIndex != null && animateIndex === placedCount - 1 && placedCount > 0) {
      cascadeRef.current = null
      animRef.current = { index: animateIndex, start: performance.now() }
    } else if (placedCount > 0 && !animRef.current) {
      cascadeRef.current = planCascade(stateRef.current.blueprint.blocks, placedCount)
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
