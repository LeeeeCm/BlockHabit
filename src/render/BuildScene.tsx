import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import type { BlockDef, Blueprint, CheckIn, MicroMood, PlacedBlock } from '../types'
import {
  DEFAULT_ISO_CONFIG,
  STUD_H,
  drawCube,
  followResize,
  isPointInsideCube,
  paletteFromDocument,
  rotateCoord,
  worldToScreen,
} from './iso'
import { drawGroundBase, drawEcoProps } from './iso'
import { currentStreakWithResilience } from '../logic/streak'
import { ecoStageFor } from '../logic/eco'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import {
  calculatePinchDistance,
  calculateTouchCenter,
  clampZoom,
  isQuickTap,
  type TouchGestureState,
} from './touchGesture'
import { triggerHaptic } from '../platform'
import { IconMood, IconStar } from '../components/Icons'
interface Props {
  blueprint: Blueprint
  placedCount: number
  /** 需要播放掉落动画的块序号（新块） */
  animateIndex?: number | null
  /** 视角旋转象限 0=0°, 1=90°, 2=180°, 3=270° */
  rotation?: number
  interactiveInspect?: boolean
  /** 是否开启 X-Ray 透视考古模式（普通块透视幽灵化，铭文随笔块琥珀高亮发光） */
  xrayMode?: boolean
  onAnimated?: () => void
}

/** 新块下落总时长：慢落 + 果冻回弹 */
const DROP_MS = 1350
const DROP_FALL_FRAC = 0.42

/** 级联时每块的总时长（快落 + 果冻） */
const BLOCK_T = 640
const CASCADE_FALL_FRAC = 0.53
/** 同层积木完全同时下落（无层内错峰） */
const LAYER_STAGGER = 0
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

export function BuildScene({
  blueprint,
  placedCount,
  animateIndex,
  rotation = 0,
  interactiveInspect = false,
  xrayMode = false,
  onAnimated,
}: Props) {
  const { t } = useI18n()
  // 悬停气泡文案经 ref 承载：指针监听只注册一次，语言切换后仍取最新值
  const bubbleLabelsRef = useRef({ bonusHabit: '', deletedHabit: '' })
  bubbleLabelsRef.current = {
    bonusHabit: t.today.fullCard.bonusHabitName,
    deletedHabit: t.today.fullCard.deletedHabitName,
  }
  const builds = useAppStore((s) => s.builds)
  const checkIns = useAppStore((s) => s.checkIns)
  const habits = useAppStore((s) => s.habits)
  const enableEcoProps = useAppStore((s) => s.settings.enableEcoProps !== false)
  // 微生态彩蛋阶段：所有在册习惯的最大连胜（含韧性接续），映射 0-4 阶段
  const ecoStage = useMemo(() => {
    if (!enableEcoProps) return 0
    const today = new Date()
    let maxStreak = 0
    for (const h of habits) {
      if (h.archivedAt) continue
      maxStreak = Math.max(maxStreak, currentStreakWithResilience(h, checkIns, today, true).streak)
    }
    return ecoStageFor(maxStreak)
  }, [habits, checkIns, enableEcoProps])

  // 1. 蓝图几何包围盒与中心点（纯蓝图静态，不随帧刷新）
  const { cx, cy } = useMemo(() => {
    let minBx = Infinity, maxBx = -Infinity, minBy = Infinity, maxBy = -Infinity
    for (const b of blueprint.blocks) {
      minBx = Math.min(minBx, b.x)
      maxBx = Math.max(maxBx, b.x)
      minBy = Math.min(minBy, b.y)
      maxBy = Math.max(maxBy, b.y)
    }
    return {
      cx: Math.round((minBx + maxBx) / 2),
      cy: Math.round((minBy + maxBy) / 2),
    }
  }, [blueprint])

  // 2. 深度排序积木序列（仅当蓝图或视角旋转变更时重算）
  const sortedCubes = useMemo(() => {
    return blueprint.blocks
      .map((b, i) => {
        const { rx, ry } = rotateCoord(b.x, b.y, cx, cy, rotation)
        return { b, i, rx, ry }
      })
      .sort((m, n) => {
        const a = m.rx + m.ry
        const c = n.rx + n.ry
        if (a !== c) return a - c
        return m.b.z - n.b.z
      })
  }, [blueprint, cx, cy, rotation])

  // 3. 空间坐标映射表（仅当已放置块数变更时重算）
  const indexAt = useMemo(() => {
    const map = new Map<string, number>()
    blueprint.blocks.slice(0, placedCount).forEach((b, i) => map.set(`${b.x},${b.y},${b.z}`, i))
    return map
  }, [blueprint, placedCount])

  // 4. 块序号 → 打卡事实元数据索引（O(1) 代替每帧循环内双重线性 find）
  const blockMetaByIndex = useMemo(() => {
    const map = new Map<number, { pb?: PlacedBlock; ci?: CheckIn; habitName?: string }>()
    const ciByPlacedBlockId = new Map<string, CheckIn>()
    for (const c of checkIns) {
      if (c.placedBlockId && !c.deletedAt) {
        ciByPlacedBlockId.set(c.placedBlockId, c)
      }
    }
    const habitMap = new Map(habits.map((h) => [h.id, h.name]))
    for (const pb of builds) {
      if (pb.blueprintId === blueprint.id) {
        const ci = ciByPlacedBlockId.get(pb.id)
        map.set(pb.index, {
          pb,
          ci,
          habitName: ci ? habitMap.get(ci.habitId) : undefined,
        })
      }
    }
    return map
  }, [blueprint.id, builds, checkIns, habits])

  const derivedRef = useRef({ cx, cy, sortedCubes, indexAt, blockMetaByIndex })
  derivedRef.current = { cx, cy, sortedCubes, indexAt, blockMetaByIndex }
  const [hoveredBlock, setHoveredBlock] = useState<{
    index: number
    x: number
    y: number
    habitName: string
    date: string
    note?: string
    mood?: MicroMood
    starred?: boolean
  } | null>(null)

  const hoveredIndexRef = useRef<number | null>(null)
  const cubesRef = useRef<Array<{ b: BlockDef; i: number; rx: number; ry: number }>>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef({ scale: 1, panX: 0, panY: 0, fitted: false })
  /** 用户手动拖拽/缩放后就不再自动取景 */
  const interactedRef = useRef(false)
  /** 上一次画布 CSS 尺寸：最大化/还原等窗口变化时据此计算跟随比例 */
  const prevSizeRef = useRef<{ w: number; h: number } | null>(null)
  const animRef = useRef<{ index: number; start: number } | null>(null)
  const cascadeRef = useRef<CascadePlan | null>(null)
  const rafRef = useRef<number | null>(null)
  const enableAmbient = useAppStore((s) => s.settings.enableAmbientLighting !== false)
  const enableGyroscope = useAppStore((s) => Boolean(s.settings.enableGyroscope))
  const gyroOffsetRef = useRef({ x: 0, y: 0 })
  const stateRef = useRef({ blueprint, placedCount, animateIndex, rotation, enableAmbient, enableGyroscope, ecoStage, xrayMode })
  stateRef.current = { blueprint, placedCount, animateIndex, rotation, enableAmbient, enableGyroscope, ecoStage, xrayMode }
  // 动画/重绘 effect 经 ref 调用 draw：调用方（BlockDropModal）的 onAnimated 回调身份
  // 变化不再重建 draw、不再重置动画计时（修复掉落动画播两遍）
  const drawRef = useRef<() => void>(() => {})
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { blueprint: bp, placedCount: pc, animateIndex: ai, rotation: rot, enableAmbient: ambient, enableGyroscope: gyroEnabled } = stateRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)

    const palette = paletteFromDocument(undefined, ambient)
    const view = viewRef.current
    const gyro = gyroEnabled ? gyroOffsetRef.current : { x: 0, y: 0 }
    ctx.translate(view.panX + gyro.x, view.panY + gyro.y)
    ctx.scale(view.scale, view.scale)

    const { cx, cy, sortedCubes: cubes, indexAt, blockMetaByIndex } = derivedRef.current
    cubesRef.current = cubes

    const cfg = DEFAULT_ISO_CONFIG
    drawGroundBase(ctx, bp.blocks, cfg, palette, rot, cx, cy)
    // 植被层：紧随底座、主体积木之前绘制（正确深度：树在建筑后面/旁边，
    // 且位置在 margin 环带内，积木精灵不会覆盖它们）
    drawEcoProps(ctx, bp.blocks, cfg, palette, rot, cx, cy, stateRef.current.ecoStage)

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

    let cascadeRunning = false
    for (const { b, i, rx, ry } of cubes) {
      if (i >= pc) continue
      const isNew = anim && ai != null && i === ai && ai === pc - 1
      const aboveIdx = indexAt.get(`${b.x},${b.y},${b.z + 1}`)
      let aboveLanded = true
      if (aboveIdx !== undefined) {
        if (cascade) {
          aboveLanded = now - cascade.start - cascade.starts[aboveIdx] >= BLOCK_T
        } else if (anim && animating && aboveIdx === ai) {
          aboveLanded = false
        }
      }

      const meta = blockMetaByIndex.get(i)
      const ci = meta?.ci
      const hasNote = Boolean(ci?.note?.trim())
      const starred = Boolean(ci?.starred)
      const isHovered = Boolean(interactiveInspect && hoveredIndexRef.current === i)

      const isGhostXRay = Boolean(stateRef.current.xrayMode && !hasNote)
      const isGlowXRay = Boolean(stateRef.current.xrayMode && hasNote)

      const faceOpts = {
        type: b.type,
        color: isGlowXRay ? '#f59e0b' : b.color,
        noStuds: aboveIdx !== undefined && aboveLanded,
        hasNote,
        starred,
        ghost: isGhostXRay,
        highlight: isHovered || isGlowXRay || Boolean(isNew && !animating),
      }

      // 级联铺设：逐层落下 + 果冻回弹
      if (cascade && !isNew) {
        const el = now - cascade.start - cascade.starts[i]
        if (el < 0) continue
        const st = cascadeState(el)
        if (!st.done) {
          cascadeRunning = true
          const { sx: cxS, sy: syBase } = worldToScreen(rx, ry, b.z, cfg)
          if (st.sx !== 1 || st.sy !== 1) {
            ctx.save()
            ctx.translate(cxS, syBase + cfg.tileH / 2 + cfg.blockH - st.z * cfg.blockH)
            ctx.scale(st.sx, st.sy)
            drawCube(ctx, 0, -(cfg.tileH / 2 + cfg.blockH), cfg, palette, faceOpts)
            ctx.restore()
          } else {
            const { sx: px, sy: py } = worldToScreen(rx, ry, b.z + st.z, cfg)
            drawCube(ctx, px, py, cfg, palette, faceOpts)
          }
          continue
        }
      }

      // 静态/新块路径：块自身高度 b.z + 动画偏移（zOff：下落抬升量）
      const zOff = isNew ? a.z : 0
      const { sx: px, sy: restSy } = worldToScreen(rx, ry, b.z, cfg)
      if (isNew && (a.sx !== 1 || a.sy !== 1)) {
        // 以静止底边为锚点缩放，抬升量只计一次
        ctx.save()
        ctx.translate(px, restSy + cfg.tileH / 2 + cfg.blockH - zOff * cfg.blockH)
        ctx.scale(a.sx, a.sy)
        drawCube(ctx, 0, -(cfg.tileH / 2 + cfg.blockH), cfg, palette, faceOpts)
        ctx.restore()
      } else {
        drawCube(ctx, px, restSy - zOff * cfg.blockH, cfg, palette, faceOpts)
      }
    }

    if (cascade) {
      cascadeRunning = cascadeRunning || now - cascade.start < cascade.total
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const scheduleNextFrame = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        draw()
      })
    }

    if (anim && animating) {
      scheduleNextFrame()
    } else if (anim) {
      animRef.current = null
      draw()
      onAnimatedRef.current?.()
    } else if (cascadeRunning) {
      scheduleNextFrame()
    } else if (cascade) {
      cascadeRef.current = null
      draw()
    }
  }, [])
  drawRef.current = draw

  // onAnimated 同样经 ref 承载，保持 draw 引用稳定（监听器不随弹窗渲染重绑）
  const onAnimatedRef = useRef(onAnimated)
  onAnimatedRef.current = onAnimated

  const touchStateRef = useRef<TouchGestureState | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const t = e.touches[0]
      touchStateRef.current = {
        startTime: performance.now(),
        startX: t.clientX,
        startY: t.clientY,
        lastX: t.clientX,
        lastY: t.clientY,
        maxDisplacement: 0,
        isMultiTouch: false,
        lastPinchDist: 0,
        lastPinchCenter: { x: t.clientX, y: t.clientY },
      }
    } else if (e.touches.length >= 2) {
      const p1 = e.touches[0]
      const p2 = e.touches[1]
      const dist = calculatePinchDistance(p1, p2)
      const center = calculateTouchCenter(p1, p2)
      if (touchStateRef.current) {
        touchStateRef.current.isMultiTouch = true
        touchStateRef.current.lastPinchDist = dist
        touchStateRef.current.lastPinchCenter = center
        touchStateRef.current.maxDisplacement = 999
      } else {
        touchStateRef.current = {
          startTime: performance.now(),
          startX: center.x,
          startY: center.y,
          lastX: center.x,
          lastY: center.y,
          maxDisplacement: 999,
          isMultiTouch: true,
          lastPinchDist: dist,
          lastPinchCenter: center,
        }
      }
    }
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      const state = touchStateRef.current
      if (!canvas || !state) return

      if (e.touches.length === 1 && !state.isMultiTouch) {
        const t = e.touches[0]
        const dx = t.clientX - state.lastX
        const dy = t.clientY - state.lastY
        state.lastX = t.clientX
        state.lastY = t.clientY
        const disp = Math.hypot(t.clientX - state.startX, t.clientY - state.startY)
        if (disp > state.maxDisplacement) {
          state.maxDisplacement = disp
        }

        interactedRef.current = true
        const view = viewRef.current
        view.panX += dx
        view.panY += dy
        draw()
      } else if (e.touches.length >= 2) {
        state.isMultiTouch = true
        state.maxDisplacement = 999
        const p1 = e.touches[0]
        const p2 = e.touches[1]
        const dist = calculatePinchDistance(p1, p2)
        const center = calculateTouchCenter(p1, p2)

        if (state.lastPinchDist > 0) {
          const factor = dist / state.lastPinchDist
          const view = viewRef.current
          const nextScale = clampZoom(view.scale * factor, 0.5, 3.0)

          const rect = canvas.getBoundingClientRect()
          const mx = center.x - rect.left
          const my = center.y - rect.top
          const panDx = center.x - state.lastPinchCenter.x
          const panDy = center.y - state.lastPinchCenter.y

          view.panX = mx - ((mx - view.panX) / view.scale) * nextScale + panDx
          view.panY = my - ((my - view.panY) / view.scale) * nextScale + panDy
          view.scale = nextScale

          interactedRef.current = true
          draw()
        }

        state.lastPinchDist = dist
        state.lastPinchCenter = center
      }
    },
    [draw],
  )

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const state = touchStateRef.current
      if (!state) return

      if (e.touches.length === 0) {
        const duration = performance.now() - state.startTime
        if (interactiveInspect && isQuickTap(duration, state.maxDisplacement)) {
          const canvas = canvasRef.current
          if (canvas) {
            const rect = canvas.getBoundingClientRect()
            const view = viewRef.current
            const cfg = DEFAULT_ISO_CONFIG
            const mx = (state.startX - rect.left - view.panX) / view.scale
            const my = (state.startY - rect.top - view.panY) / view.scale

            const pc = stateRef.current.placedCount
            let hit: { b: BlockDef; i: number; rx: number; ry: number } | null = null
            const cubes = cubesRef.current
            for (let k = cubes.length - 1; k >= 0; k--) {
              const item = cubes[k]
              if (item.i >= pc) continue
              const { sx, sy } = worldToScreen(item.rx, item.ry, item.b.z, cfg)
              if (isPointInsideCube(mx, my, sx, sy, cfg)) {
                hit = item
                break
              }
            }

            if (hit) {
              triggerHaptic('light')
              hoveredIndexRef.current = hit.i
              const meta = derivedRef.current.blockMetaByIndex.get(hit.i)
              const ci = meta?.ci
              const labels = bubbleLabelsRef.current
              const habitName = meta?.habitName || (ci ? labels.deletedHabit : meta?.pb?.bonus ? labels.bonusHabit : '—')
              setHoveredBlock({
                index: hit.i,
                x: state.startX - rect.left,
                y: state.startY - rect.top,
                habitName,
                date: ci?.date || '',
                note: ci?.note,
                mood: ci?.mood,
                starred: ci?.starred,
              })
              draw()
            } else if (hoveredIndexRef.current !== null) {
              hoveredIndexRef.current = null
              setHoveredBlock(null)
              draw()
            }
          }
        }
        touchStateRef.current = null
      } else if (e.touches.length === 1) {
        const t = e.touches[0]
        state.isMultiTouch = false
        state.startX = t.clientX
        state.startY = t.clientY
        state.lastX = t.clientX
        state.lastY = t.clientY
        state.lastPinchDist = 0
        state.maxDisplacement = 999
      } else if (e.touches.length >= 2) {
        state.lastPinchCenter = calculateTouchCenter(e.touches[0], e.touches[1])
        state.maxDisplacement = 999
      }
    },
    [draw],
  )

  const handleTouchCancel = useCallback(() => {
    touchStateRef.current = null
  }, [])

  // 尺寸初始化 + 自适应：未手动取景时最大化/放大窗口重新取景（场景保持在中心偏下）；
  // 已手动取景（拖拽/滚轮缩放过）时模型随窗口等比缩放并保持窗口内相对位置
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    /** 模型（含地基余量、凸点、块身）在等距平面坐标中的可见包围盒 */
    const sceneBounds = () => {
      const { blueprint: bp, rotation: rot } = stateRef.current
      const cfg = DEFAULT_ISO_CONFIG
      let minBx = Infinity, maxBx = -Infinity, minBy = Infinity, maxBy = -Infinity
      for (const b of bp.blocks) {
        minBx = Math.min(minBx, b.x)
        maxBx = Math.max(maxBx, b.x)
        minBy = Math.min(minBy, b.y)
        maxBy = Math.max(maxBy, b.y)
      }
      const cx = Math.round((minBx + maxBx) / 2)
      const cy = Math.round((minBy + maxBy) / 2)

      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const b of bp.blocks) {
        const { rx, ry } = rotateCoord(b.x, b.y, cx, cy, rot)
        minX = Math.min(minX, rx)
        maxX = Math.max(maxX, rx)
        minY = Math.min(minY, ry)
        maxY = Math.max(maxY, ry)
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
        const { rx, ry } = rotateCoord(b.x, b.y, cx, cy, rot)
        const { sx, sy } = worldToScreen(rx, ry, b.z, cfg)
        xs.push(sx + cfg.tileW / 2, sx - cfg.tileW / 2)
        ys.push(sy + cfg.tileH / 2 + cfg.blockH, sy - cfg.tileH / 2 - STUD_H)
      }
      for (const [x, y] of corners) {
        const { sx, sy } = worldToScreen(x, y, 0, cfg)
        xs.push(sx + cfg.tileW / 2, sx - cfg.tileW / 2)
        ys.push(sy)
      }
      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
      }
    }
    const fitView = () => {
      const { minX, maxX, minY, maxY } = sceneBounds()
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const PAD = 48
      const scale = Math.min(
        (w - PAD * 2) / (maxX - minX),
        (h - PAD * 2) / (maxY - minY),
        2,
      )
      viewRef.current = {
        scale,
        panX: w / 2 - ((minX + maxX) / 2) * scale,
        // 中心偏下：整体下移约 6% 视口高度
        panY: h * 0.56 - ((minY + maxY) / 2) * scale,
        fitted: true,
      }
    }
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) return
      canvas.width = w * dpr
      canvas.height = h * dpr
      const prev = prevSizeRef.current
      if (!interactedRef.current) {
        fitView()
      } else if (prev && (prev.w !== w || prev.h !== h)) {
        const { minX, maxX, minY, maxY } = sceneBounds()
        viewRef.current = {
          ...followResize(
            viewRef.current,
            { w: prev.w, h: prev.h },
            { w, h },
            { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
          ),
          fitted: viewRef.current.fitted,
        }
      }
      prevSizeRef.current = { w, h }
      draw()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    // 跨显示器拖动：DPR 变化不触发 ResizeObserver，用分辨率媒体查询监听补偿（触发后换绑新分辨率）
    const dprQuery = () => `(resolution: ${Math.min(window.devicePixelRatio || 1, 2)}dppx)`
    const onDprChange = () => {
      resize()
      dprMq?.removeEventListener('change', onDprChange)
      dprMq = typeof window.matchMedia === 'function' ? window.matchMedia(dprQuery()) : null
      dprMq?.addEventListener('change', onDprChange)
    }
    let dprMq: MediaQueryList | null =
      typeof window.matchMedia === 'function' ? window.matchMedia(dprQuery()) : null
    dprMq?.addEventListener('change', onDprChange)
    return () => {
      dprMq?.removeEventListener('change', onDprChange)
      ro.disconnect()
    }
  }, [draw])

  // 状态变化重绘：新块 → 慢落果冻；每次进入建造页 → 逐层级联
  // （依赖不含 draw/onAnimated：弹窗打字、微状态切换不会重置动画计时）
  useEffect(() => {
    if (animateIndex != null && animateIndex === placedCount - 1 && placedCount > 0) {
      cascadeRef.current = null
      animRef.current = { index: animateIndex, start: performance.now() }
    } else if (placedCount > 0 && !animRef.current) {
      cascadeRef.current = planCascade(stateRef.current.blueprint.blocks, placedCount)
    }
    drawRef.current()
  }, [placedCount, animateIndex])

  // 视角旋转仅触发重绘，不重播级联掉落动画
  useEffect(() => {
    drawRef.current()
  }, [rotation])
  // 环境光照与重力视差偏好切换时触发重绘
  // 环境光照、重力视差与微生态彩蛋偏好切换时触发重绘
  useEffect(() => {
    drawRef.current()
  }, [enableAmbient, enableGyroscope, ecoStage, xrayMode])

  // 交互：拖拽平移 / 滚轮缩放
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let dragging = false
    let lastX = 0
    let lastY = 0

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
      if (hoveredIndexRef.current !== null) {
        hoveredIndexRef.current = null
        setHoveredBlock(null)
        draw()
      }
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const view = viewRef.current
      if (dragging) {
        interactedRef.current = true
        view.panX += e.clientX - lastX
        view.panY += e.clientY - lastY
        lastX = e.clientX
        lastY = e.clientY
        draw()
        return
      }

      if (!interactiveInspect) return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const cfg = DEFAULT_ISO_CONFIG
      const mx = (e.clientX - rect.left - view.panX) / view.scale
      const my = (e.clientY - rect.top - view.panY) / view.scale

      const pc = stateRef.current.placedCount
      let hit: { b: BlockDef; i: number; rx: number; ry: number } | null = null
      const cubes = cubesRef.current
      for (let k = cubes.length - 1; k >= 0; k--) {
        const item = cubes[k]
        if (item.i >= pc) continue
        const { sx, sy } = worldToScreen(item.rx, item.ry, item.b.z, cfg)
        if (isPointInsideCube(mx, my, sx, sy, cfg)) {
          hit = item
          break
        }
      }

      if (hit) {
        if (hoveredIndexRef.current !== hit.i) {
          hoveredIndexRef.current = hit.i
          const meta = derivedRef.current.blockMetaByIndex.get(hit.i)
          const ci = meta?.ci
          const labels = bubbleLabelsRef.current
          const habitName = meta?.habitName || (ci ? labels.deletedHabit : meta?.pb?.bonus ? labels.bonusHabit : '—')
          setHoveredBlock({
            index: hit.i,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            habitName,
            date: ci?.date || '',
            note: ci?.note,
            mood: ci?.mood,
            starred: ci?.starred,
          })
          draw()
        } else {
          setHoveredBlock((prev) =>
            prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null,
          )
        }
      } else if (hoveredIndexRef.current !== null) {
        hoveredIndexRef.current = null
        setHoveredBlock(null)
        draw()
      }
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      dragging = false
    }
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (hoveredIndexRef.current !== null) {
        hoveredIndexRef.current = null
        setHoveredBlock(null)
        draw()
      }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      interactedRef.current = true
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
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [draw, interactiveInspect])
  // 移动端重力感应微视差交互（遵循无障碍减弱动态标准，仅在用户显式开启时激活）
  useEffect(() => {
    if (!enableGyroscope || typeof window === 'undefined' || !window.DeviceOrientationEvent) return
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      const targetX = Math.max(-5, Math.min(5, (e.gamma / 30) * 5))
      const targetY = Math.max(-5, Math.min(5, ((e.beta - 45) / 30) * 5))
      gyroOffsetRef.current = {
        x: gyroOffsetRef.current.x * 0.8 + targetX * 0.2,
        y: gyroOffsetRef.current.y * 0.8 + targetY * 0.2,
      }
      draw()
    }
    window.addEventListener('deviceorientation', onOrientation)
    return () => window.removeEventListener('deviceorientation', onOrientation)
  }, [enableGyroscope, draw])
  // 组件卸载时安全取消未决动画帧，彻底杜绝后台泄漏
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      />
      {hoveredBlock && interactiveInspect && (
        <div
          className="brick-inspect-popover"
          style={{
            position: 'absolute',
            left: Math.min(
              (canvasRef.current?.clientWidth ?? 400) - 280,
              Math.max(12, hoveredBlock.x + 14),
            ),
            top: Math.min(
              (canvasRef.current?.clientHeight ?? 400) - 150,
              Math.max(12, hoveredBlock.y - 36),
            ),
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
              {t.reflections.brickInspectTitle(hoveredBlock.index)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {hoveredBlock.starred && <IconStar size={12} filled style={{ color: 'var(--accent)', flexShrink: 0 }} />}
              {hoveredBlock.mood && (
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 999,
                    background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))',
                    color: 'var(--ink)',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <IconMood mood={hoveredBlock.mood} size={11} style={{ flexShrink: 0 }} />
                  <span>{t.microMood[hoveredBlock.mood]}</span>
                </span>
              )}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 6 }}>
            {t.reflections.brickInspectFrom(hoveredBlock.habitName, hoveredBlock.date || '—')}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--ink)',
              lineHeight: 1.45,
              fontStyle: hoveredBlock.note ? 'normal' : 'italic',
              opacity: hoveredBlock.note ? 0.95 : 0.6,
            }}
          >
            {hoveredBlock.note || t.reflections.brickInspectNoNote}
          </div>
        </div>
      )}
    </div>
  )
}
