import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import type { Blueprint, CheckIn } from '../types'
import { rotateCoord } from './iso'
import { planCascade, type CascadePlan } from './sceneMotion'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import { isQuickTap, type TouchGestureState } from './touchGesture'
import { triggerHaptic } from '../platform'
import { prefersReducedMotion } from '../platform/dom'
import {
  applyZoomAt,
  beginMultiTouch,
  beginSingleTouch,
  buildHoveredBlock,
  dragSingleTouch,
  fitSceneView,
  followSceneResize,
  hitTestCube,
  pinchMove,
  retargetMultiTouch,
  retargetSingleTouch,
  scenePointFromClient
} from './buildscene/cameraGesture'
import { computeEcoStage } from './buildscene/ecoStage'
import { drawScene } from './buildscene/sceneDraw'
import { SceneStage } from './buildscene/SceneStage'
import type {
  BlockMeta,
  CubeEntry,
  DerivedScene,
  HoveredBlock,
  SceneRuntime,
  SceneState,
  ViewState
} from './buildscene/sceneTypes'

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
export function BuildScene({
  blueprint,
  placedCount,
  animateIndex,
  rotation = 0,
  interactiveInspect = false,
  xrayMode = false,
  onAnimated
}: Props) {
  const { t } = useI18n()
  // 悬停气泡文案经 ref 承载：指针监听只注册一次，语言切换后仍取最新值
  const bubbleLabelsRef = useRef({ bonusHabit: '', deletedHabit: '' })
  bubbleLabelsRef.current = {
    bonusHabit: t.today.fullCard.bonusHabitName,
    deletedHabit: t.today.fullCard.deletedHabitName
  }
  const builds = useAppStore((s) => s.builds)
  const checkIns = useAppStore((s) => s.checkIns)
  const habits = useAppStore((s) => s.habits)
  const enableEcoProps = useAppStore((s) => s.settings.enableEcoProps !== false)
  // 微生态彩蛋阶段：所有在册习惯的最大连胜（含韧性接续），映射 0-4 阶段
  const ecoStage = useMemo(
    () => computeEcoStage(habits, checkIns, enableEcoProps),
    [habits, checkIns, enableEcoProps]
  )

  // 1. 蓝图几何包围盒与中心点（纯蓝图静态，不随帧刷新）
  const { cx, cy } = useMemo(() => {
    let minBx = Infinity,
      maxBx = -Infinity,
      minBy = Infinity,
      maxBy = -Infinity
    for (const b of blueprint.blocks) {
      minBx = Math.min(minBx, b.x)
      maxBx = Math.max(maxBx, b.x)
      minBy = Math.min(minBy, b.y)
      maxBy = Math.max(maxBy, b.y)
    }
    return {
      cx: Math.round((minBx + maxBx) / 2),
      cy: Math.round((minBy + maxBy) / 2)
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
    const map = new Map<number, BlockMeta>()
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
          habitName: ci ? habitMap.get(ci.habitId) : undefined
        })
      }
    }
    return map
  }, [blueprint.id, builds, checkIns, habits])

  const derivedRef = useRef<DerivedScene>({ cx, cy, sortedCubes, indexAt, blockMetaByIndex })
  derivedRef.current = { cx, cy, sortedCubes, indexAt, blockMetaByIndex }
  const [hoveredBlock, setHoveredBlock] = useState<HoveredBlock | null>(null)

  const hoveredIndexRef = useRef<number | null>(null)
  const cubesRef = useRef<CubeEntry[]>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<ViewState>({ scale: 1, panX: 0, panY: 0, fitted: false })
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
  const stateRef = useRef<SceneState>({
    blueprint,
    placedCount,
    animateIndex,
    rotation,
    enableAmbient,
    enableGyroscope,
    ecoStage,
    xrayMode
  })
  stateRef.current = {
    blueprint,
    placedCount,
    animateIndex,
    rotation,
    enableAmbient,
    enableGyroscope,
    ecoStage,
    xrayMode
  }
  // onAnimated 同样经 ref 承载，保持 draw 引用稳定（监听器不随弹窗渲染重绑）
  const onAnimatedRef = useRef(onAnimated)
  onAnimatedRef.current = onAnimated
  // 动画/重绘 effect 经 ref 调用 draw：调用方（BlockDropModal）的 onAnimated 回调身份
  // 变化不再重建 draw、不再重置动画计时（修复掉落动画播两遍）
  const drawRef = useRef<() => void>(() => {})
  const draw = useCallback(() => {
    const runtime: SceneRuntime = {
      canvasRef,
      stateRef,
      derivedRef,
      viewRef,
      gyroOffsetRef,
      animRef,
      cascadeRef,
      rafRef,
      cubesRef,
      hoveredIndexRef,
      onAnimatedRef,
      // 同步续帧经 ref 取当前 draw，保证下一帧读到最新 refs
      redraw: () => drawRef.current(),
      // 与拆分前的 draw 闭包口径一致：只捕获挂载首帧的 interactiveInspect
      interactiveInspect
    }
    drawScene(runtime)
  }, [])
  drawRef.current = draw

  const touchStateRef = useRef<TouchGestureState | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      touchStateRef.current = beginSingleTouch(e.touches[0])
    } else if (e.touches.length >= 2) {
      touchStateRef.current = beginMultiTouch(e.touches[0], e.touches[1], touchStateRef.current)
    }
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      const state = touchStateRef.current
      if (!canvas || !state) return

      if (e.touches.length === 1 && !state.isMultiTouch) {
        const { dx, dy } = dragSingleTouch(state, e.touches[0])
        interactedRef.current = true
        const view = viewRef.current
        view.panX += dx
        view.panY += dy
        draw()
      } else if (e.touches.length >= 2) {
        const zoomed = pinchMove(state, e.touches[0], e.touches[1], viewRef.current, canvas)
        if (zoomed) {
          interactedRef.current = true
          draw()
        }
      }
    },
    [draw]
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
            const { mx, my } = scenePointFromClient(rect, view, state.startX, state.startY)
            const hit = hitTestCube(cubesRef.current, stateRef.current.placedCount, mx, my)

            if (hit) {
              triggerHaptic('light')
              hoveredIndexRef.current = hit.i
              const meta = derivedRef.current.blockMetaByIndex.get(hit.i)
              setHoveredBlock(
                buildHoveredBlock(
                  hit.i,
                  { x: state.startX - rect.left, y: state.startY - rect.top },
                  meta,
                  bubbleLabelsRef.current
                )
              )
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
        retargetSingleTouch(state, e.touches[0])
      } else if (e.touches.length >= 2) {
        retargetMultiTouch(state, e.touches[0], e.touches[1])
      }
    },
    [draw]
  )

  const handleTouchCancel = useCallback(() => {
    touchStateRef.current = null
  }, [])

  // 尺寸初始化 + 自适应：未手动取景时最大化/放大窗口重新取景（场景保持在中心偏下）；
  // 已手动取景（拖拽/滚轮缩放过）时模型随窗口等比缩放并保持窗口内相对位置
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) return
      canvas.width = w * dpr
      canvas.height = h * dpr
      const prev = prevSizeRef.current
      if (!interactedRef.current) {
        viewRef.current = fitSceneView(stateRef.current, w, h)
      } else if (prev && (prev.w !== w || prev.h !== h)) {
        viewRef.current = followSceneResize(viewRef.current, prev, { w, h }, stateRef.current)
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
    // 无障碍（A5）：系统要求减少动态效果时，不播慢落/级联，积木直接落位并立刻回调
    const reduced = prefersReducedMotion()
    if (animateIndex != null && animateIndex === placedCount - 1 && placedCount > 0) {
      cascadeRef.current = null
      animRef.current = reduced ? null : { index: animateIndex, start: performance.now() }
      if (reduced) onAnimatedRef.current?.()
    } else if (placedCount > 0 && !animRef.current) {
      cascadeRef.current = reduced
        ? null
        : planCascade(stateRef.current.blueprint.blocks, placedCount)
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
      const { mx, my } = scenePointFromClient(rect, view, e.clientX, e.clientY)
      const hit = hitTestCube(cubesRef.current, stateRef.current.placedCount, mx, my)

      if (hit) {
        if (hoveredIndexRef.current !== hit.i) {
          hoveredIndexRef.current = hit.i
          const meta = derivedRef.current.blockMetaByIndex.get(hit.i)
          setHoveredBlock(
            buildHoveredBlock(
              hit.i,
              { x: e.clientX - rect.left, y: e.clientY - rect.top },
              meta,
              bubbleLabelsRef.current
            )
          )
          draw()
        } else {
          setHoveredBlock((prev) =>
            prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null
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
      applyZoomAt(view, mx, my, next)
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
        y: gyroOffsetRef.current.y * 0.8 + targetY * 0.2
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
    <SceneStage
      canvasRef={canvasRef}
      hoveredBlock={hoveredBlock}
      interactiveInspect={interactiveInspect}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    />
  )
}
