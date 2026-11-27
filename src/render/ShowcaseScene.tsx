import { useCallback, useEffect, useRef, useMemo } from 'react'
import type { Blueprint, SandboxDesign, ShowcasePlacement } from '../types'
import { DEFAULT_ISO_CONFIG, paletteFromDocument, type IsoPalette } from './iso'
import {
  canPlaceModel,
  rotationsFromPlacements,
  screenToGroundIso,
  SHOWCASE_GRID_SIZE
} from '../logic/showcase'
import {
  buildBaseGeometry,
  buildFootprintMap,
  buildOffsetBlocksMap,
  buildRotatedFootprintMap,
  collectSortedCubes,
  type RenderCube
} from './showcaseLayout'
import { playSnapSound } from '../audio/sound'
import {
  calculatePinchDistance,
  calculateTouchCenter,
  isQuickTap,
  type TouchGestureState
} from './touchGesture'
import { triggerHaptic } from '../platform'
import { useAppStore } from '../store/appStore'
import { applyPinchZoom, applyWheelZoom, fitShowcaseView } from './showcase/camera'
import {
  buildSandboxBasePalette,
  drawDragFootprint,
  drawShowcaseCubes,
  drawShowcaseShadows,
  renderShowcaseBase
} from './showcase/canvas'
import { buildBonusByBlueprint } from './showcase/derived'
import { buildDragCubes, mergeDragCubes, snapDragTarget, type DragState } from './showcase/drag'
import { clientToWorldPoint, findModelAtWorldPoint, resolveFootprint } from './showcase/hitTest'
import {
  beginMultiTouch,
  beginSingleTouch,
  endTouchGesture,
  trackSingleTouchPan
} from './showcase/touch'

interface Props {
  placements: ShowcasePlacement[]
  blueprintsMap: Record<string, Blueprint>
  onUpdatePlacement: (blueprintId: string, gridX: number, gridY: number) => boolean
  onSelectModel?: (blueprintId: string) => void
  /** 右键 / 长按模型：把菜单交给页面（D-20261127-127） */
  onModelContextMenu?: (blueprintId: string, clientX: number, clientY: number) => void
  /** 当前沙盘设计：只决定底座颜色（D-20261128-129，展示台不再生成植被） */
  design?: SandboxDesign
  /** 切换沙盘时重新取景（值变化即 fit） */
  viewFitKey?: string
}

/**
 * 展台沙盘（Showcase Island）：
 * SHOWCASE_GRID_SIZE×SHOWCASE_GRID_SIZE（当前 26×26）等距实体展台底座、
 * 多模型全局遮挡排序渲染、AABB 碰撞磁吸检测与无碰撞自由拖拽。
 * D-20261127-127：旋转随 placement 持久化；右键/长按回调交给页面弹菜单。
 * D-20261128-129：沙盘设计只决定底座颜色，展台不生成植被。
 */
export function ShowcaseScene({
  placements,
  blueprintsMap,
  onUpdatePlacement,
  onSelectModel,
  onModelContextMenu,
  design = 'moss',
  viewFitKey = ''
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef({ scale: 0.9, panX: 0, panY: 0, fitted: false })
  const dragRef = useRef<DragState | null>(null)
  const hoveredIdRef = useRef<string | null>(null)
  const enableAmbient = useAppStore((s) => s.settings.enableAmbientLighting !== false)
  const enableGyroscope = useAppStore((s) => Boolean(s.settings.enableGyroscope))
  const theme = useAppStore((s) => s.settings.theme)
  const builds = useAppStore((s) => s.builds)

  // B1/B5：蓝图 → 序位 → 奖励等级（streak / attendance）。用 ref 承载，避免进入 draw 的依赖数组导致重绑监听
  const bonusByBlueprint = useMemo(() => buildBonusByBlueprint(builds), [builds])
  const bonusRef = useRef(bonusByBlueprint)
  bonusRef.current = bonusByBlueprint
  const gyroOffsetRef = useRef({ x: 0, y: 0 })
  const settingsRef = useRef({ enableAmbient, enableGyroscope })
  settingsRef.current = { enableAmbient, enableGyroscope }

  const cfg = DEFAULT_ISO_CONFIG
  const G = SHOWCASE_GRID_SIZE

  const placementsRef = useRef(placements)
  placementsRef.current = placements
  // 旋转表从 placements 派生（持久化语义）：绘制/命中/拖拽校验共用同一口径
  const rotations = useMemo(() => rotationsFromPlacements(placements), [placements])
  const rotationsRef = useRef(rotations)
  rotationsRef.current = rotations
  const designRef = useRef(design)
  designRef.current = design

  // 1. 静态实木沙盘底托曲线采样点（E5：纯几何搬到 showcaseLayout，按 cfg/G 记忆）
  const baseGeometry = useMemo(() => buildBaseGeometry(cfg, G), [cfg, G])

  // 2. 蓝图模型包围盒尺寸缓存
  const footprintMap = useMemo(() => buildFootprintMap(blueprintsMap), [blueprintsMap])
  // 2.5 持久化旋转（D-20261127-127）：按 placement.rotation 派生的蓝图足迹表
  //     （阴影/命中/拖拽共用）。rotations 为空时与 footprintMap 完全一致。
  const rotatedFootprintMap = useMemo(
    () => buildRotatedFootprintMap(blueprintsMap, rotations),
    [blueprintsMap, rotations]
  )
  // 3. 静态排序列表：所有模型按当前落位展开并排好序；拖拽时仅与"被拖模型"双有序归并，
  //    不再每帧全量重建 + 全量排序（ref 承载保持 draw 引用稳定，不触发监听重绑）
  const sortedStaticCubes = useMemo(
    () => collectSortedCubes(placements, blueprintsMap, footprintMap, rotations),
    [placements, blueprintsMap, footprintMap, rotations]
  )
  const sortedStaticCubesRef = useRef(sortedStaticCubes)
  sortedStaticCubesRef.current = sortedStaticCubes

  // E2：命中检测用的 footprint 表与「带落位偏移的积木列表」都是 placements 的纯派生，
  // 每帧/每次 pointermove 重算会让已落成模型 × 每座块数（当前最大 190 块）次迭代白跑。
  // D-20261111-068：命中/拖拽校验用「带会话旋转」的足迹表（默认空表 = 原 footprint）。
  const footprintRef = useRef(rotatedFootprintMap)
  footprintRef.current = rotatedFootprintMap
  // 已落位模型的偏移积木坐标（阴影绘制与命中检测共用；placements/rotations 不变时引用不变）
  const offsetBlocksMap = useMemo(
    () => buildOffsetBlocksMap(placements, blueprintsMap, footprintMap, rotations),
    [placements, blueprintsMap, footprintMap, rotations]
  )
  const offsetBlocksRef = useRef(offsetBlocksMap)
  offsetBlocksRef.current = offsetBlocksMap

  // 4. 静态底座离屏层缓存：视口/dpr/主题任一变化才重绘（拖拽与悬停期间恒命中）
  const baseCacheRef = useRef<{ canvas: HTMLCanvasElement; key: string } | null>(null)

  const renderBase = useCallback(
    (bctx: CanvasRenderingContext2D, palette: IsoPalette) => {
      renderShowcaseBase(bctx, palette, baseGeometry, cfg, G)
    },
    [baseGeometry, cfg, G]
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const { enableAmbient: ambient, enableGyroscope: gyroEnabled } = settingsRef.current
    const palette = paletteFromDocument(undefined, ambient)
    // 沙盘设计底色：只给底座染色，建筑积木仍用主题 palette（D-20261128-128）
    const basePalette = buildSandboxBasePalette(palette, designRef.current)
    const view = viewRef.current
    const gyro = gyroEnabled ? gyroOffsetRef.current : { x: 0, y: 0 }

    // 1. 静态底座离屏层：拖拽/悬停/陀螺仪静止期间恒命中，仅视口、dpr、主题变化时重绘
    const baseKey = `${w}x${h}|${dpr}|${view.scale}|${view.panX}|${view.panY}|${gyro.x}|${gyro.y}|${ambient}|${basePalette.ink}|${basePalette.top}|${basePalette.left}|${basePalette.right}`
    let base = baseCacheRef.current
    if (!base || base.key !== baseKey) {
      // 复用同一块离屏 canvas：平移/缩放时 baseKey 每帧都变，若每帧新建 canvas + 取上下文
      // 会产生持续的显存分配与 GC 抖动（E2）。只在尺寸变化时改 width/height（会自动清空）。
      const off = base?.canvas ?? document.createElement('canvas')
      const ow = Math.max(1, Math.round(w * dpr))
      const oh = Math.max(1, Math.round(h * dpr))
      if (off.width !== ow || off.height !== oh) {
        off.width = ow
        off.height = oh
      }
      const octx = off.getContext('2d')
      if (octx) {
        octx.setTransform(1, 0, 0, 1, 0, 0)
        octx.clearRect(0, 0, ow, oh)
        octx.setTransform(dpr, 0, 0, dpr, 0, 0)
        octx.translate(view.panX + gyro.x, view.panY + gyro.y)
        octx.scale(view.scale, view.scale)
        renderBase(octx, basePalette)
        base = { canvas: off, key: baseKey }
        baseCacheRef.current = base
      }
    }
    if (base) {
      ctx.drawImage(base.canvas, 0, 0, w, h)
    }
    ctx.translate(view.panX + gyro.x, view.panY + gyro.y)
    ctx.scale(view.scale, view.scale)

    // 2.4 每个落位模型的地面接触阴影（积木之前绘制）
    drawShowcaseShadows(ctx, placementsRef.current, offsetBlocksRef.current, cfg, palette)

    // 3. 拖拽时地基磁吸 / 碰撞警告脚印
    const drag = dragRef.current
    if (drag) {
      const bp = blueprintsMap[drag.blueprintId]
      if (bp) {
        const fp = resolveFootprint(
          bp,
          footprintRef.current,
          rotationsRef.current,
          drag.blueprintId
        )
        drawDragFootprint(ctx, drag.currentGx, drag.currentGy, fp, drag.isValid, cfg)
      }
    }

    // 建筑绘制：无拖拽直接复用静态排序列表（零重建）；拖拽时剔除被拖模型后
    //    与被拖模型的有序列表做线性归并（O(n) 替代每帧 O(n log n) 重建+排序）
    const staticCubes = sortedStaticCubesRef.current
    let drawList: RenderCube[]
    if (!drag) {
      drawList = staticCubes
    } else {
      const bp = blueprintsMap[drag.blueprintId]
      const dragRotation = rotationsRef.current[drag.blueprintId] ?? 0
      const fp = bp
        ? resolveFootprint(bp, footprintRef.current, rotationsRef.current, drag.blueprintId)
        : null
      const dragCubes = bp && fp ? buildDragCubes(bp, fp, dragRotation, drag) : []
      drawList = mergeDragCubes(staticCubes, dragCubes, drag.blueprintId)
    }

    drawShowcaseCubes(ctx, drawList, cfg, palette, hoveredIdRef.current, drag, bonusRef.current)
  }, [blueprintsMap, cfg, G, footprintMap, renderBase])

  // 当外部 placements 数据变更时（例如自动排列、右侧堆场陈列或 store 同步），触发即时画布重绘
  useEffect(() => {
    draw()
  }, [placements, draw])
  // 沙盘颜色变化时重绘（旋转已包含在 placements 的引用变化里）
  useEffect(() => {
    draw()
  }, [design, draw])
  // 主题切换：App 的 data-theme 副作用与子组件 effect 的执行顺序不保证，
  // 延后一帧再重绘，确保 paletteFromDocument 读到新主题，画布不会停留在旧调色板。
  useEffect(() => {
    const id = requestAnimationFrame(() => draw())
    return () => cancelAnimationFrame(id)
  }, [theme, draw])
  // 切换沙盘：重新取景，避免上一个沙盘的缩放/平移把新布局推出视口
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w === 0 || h === 0) return
    viewRef.current = fitShowcaseView(w, h, cfg, G)
    draw()
  }, [viewFitKey, cfg, G, draw])
  // 初始化与自适应窗口大小
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

      if (!viewRef.current.fitted) {
        viewRef.current = fitShowcaseView(w, h, cfg, G)
      }
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
  }, [draw, cfg, G])
  const findModelAtScreenPoint = useCallback(
    (clientX: number, clientY: number): string | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const { worldPx, worldPy } = clientToWorldPoint(
        clientX,
        clientY,
        canvas.getBoundingClientRect(),
        viewRef.current,
        cfg.tileH
      )
      return findModelAtWorldPoint(
        worldPx,
        worldPy,
        placementsRef.current,
        blueprintsMap,
        footprintRef.current,
        rotationsRef.current,
        cfg.tileW,
        cfg.tileH
      )
    },
    [blueprintsMap, cfg.tileH, cfg.tileW]
  )

  const touchStateRef = useRef<TouchGestureState | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressFiredRef = useRef(false)

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  // 切换沙盘或卸载：清掉旧沙盘残留的拖拽/悬停/长按交互态
  useEffect(() => {
    const canvas = canvasRef.current
    dragRef.current = null
    hoveredIdRef.current = null
    touchStateRef.current = null
    longPressFiredRef.current = false
    clearLongPress()
    if (canvas) canvas.style.cursor = 'default'
    return clearLongPress
  }, [viewFitKey, clearLongPress])

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      clearLongPress()
      longPressFiredRef.current = false
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        touchStateRef.current = beginSingleTouch(touch)
        // 移动端长按 = 右键菜单（旋转 / 收拢）；移动超过 8px 视为平移，取消长按
        if (onModelContextMenu) {
          longPressTimerRef.current = window.setTimeout(() => {
            longPressTimerRef.current = null
            const state = touchStateRef.current
            if (!state || state.isMultiTouch || state.maxDisplacement > 8) return
            const hitId = findModelAtScreenPoint(state.startX, state.startY)
            if (!hitId) return
            longPressFiredRef.current = true
            touchStateRef.current = null
            triggerHaptic('medium')
            onModelContextMenu(hitId, state.startX, state.startY)
          }, 520)
        }
      } else if (e.touches.length >= 2) {
        clearLongPress()
        touchStateRef.current = beginMultiTouch(touchStateRef.current, e.touches[0], e.touches[1])
      }
    },
    [clearLongPress, findModelAtScreenPoint, onModelContextMenu]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      const state = touchStateRef.current
      if (!canvas || !state) return

      if (e.touches.length === 1 && !state.isMultiTouch) {
        const { dx, dy } = trackSingleTouchPan(state, e.touches[0])
        if (state.maxDisplacement > 10) clearLongPress()

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
          applyPinchZoom(
            viewRef.current,
            canvas.getBoundingClientRect(),
            state.lastPinchCenter,
            center,
            dist / state.lastPinchDist
          )
          draw()
        }

        state.lastPinchDist = dist
        state.lastPinchCenter = center
      }
    },
    [draw, clearLongPress]
  )

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      clearLongPress()
      if (longPressFiredRef.current) {
        longPressFiredRef.current = false
        touchStateRef.current = null
        return
      }
      const state = touchStateRef.current
      if (!state) return

      if (!endTouchGesture(state, e.touches)) return
      const duration = performance.now() - state.startTime
      if (isQuickTap(duration, state.maxDisplacement)) {
        const hitId = findModelAtScreenPoint(state.startX, state.startY)
        if (hitId) {
          triggerHaptic('light')
          onSelectModel?.(hitId)
        }
      }
      touchStateRef.current = null
    },
    [clearLongPress, findModelAtScreenPoint, onSelectModel]
  )

  const handleTouchCancel = useCallback(() => {
    clearLongPress()
    longPressFiredRef.current = false
    touchStateRef.current = null
  }, [clearLongPress])

  // 鼠标交互：拖拽移动、碰撞反馈与点击选中
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let panDragging = false
    let panStartX = 0
    let panStartY = 0

    function getScreenPoint(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const { worldPx, worldPy } = clientToWorldPoint(
        e.clientX,
        e.clientY,
        rect,
        viewRef.current,
        cfg.tileH
      )
      return { mx: e.clientX - rect.left, my: e.clientY - rect.top, worldPx, worldPy }
    }

    function findModelUnderPointer(worldPx: number, worldPy: number): string | null {
      return findModelAtWorldPoint(
        worldPx,
        worldPy,
        placementsRef.current,
        blueprintsMap,
        footprintRef.current,
        rotationsRef.current,
        cfg.tileW,
        cfg.tileH
      )
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      // 右键交给 contextmenu（旋转/收拢菜单），不进入拖拽或平移
      if (e.button !== 0) return
      canvas.setPointerCapture(e.pointerId)
      const { mx, my, worldPx, worldPy } = getScreenPoint(e)
      const hitId = findModelUnderPointer(worldPx, worldPy)

      if (hitId) {
        // 命中建筑模型：进入模型拖拽状态
        const p = placementsRef.current.find((x) => x.blueprintId === hitId)!
        dragRef.current = {
          blueprintId: hitId,
          startGx: p.gridX,
          startGy: p.gridY,
          currentGx: p.gridX,
          currentGy: p.gridY,
          isValid: true,
          hasMoved: false,
          downPx: mx,
          downPy: my
        }
      } else {
        // 命中空地：进入沙盘平移状态
        panDragging = true
        panStartX = mx
        panStartY = my
      }
      draw()
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const { mx, my, worldPx, worldPy } = getScreenPoint(e)
      const drag = dragRef.current

      if (drag) {
        if (Math.hypot(mx - drag.downPx, my - drag.downPy) > 5) {
          drag.hasMoved = true
        }
        const { gx, gy } = screenToGroundIso(worldPx, worldPy, cfg.tileW, cfg.tileH)
        const bp = blueprintsMap[drag.blueprintId]
        const fp = bp
          ? resolveFootprint(bp, footprintRef.current, rotationsRef.current, drag.blueprintId)
          : { width: 1, depth: 1 }

        // 磁吸对齐至整数网格坐标
        const { targetGx, targetGy } = snapDragTarget(gx, gy, fp, G)

        drag.currentGx = targetGx
        drag.currentGy = targetGy
        drag.isValid = canPlaceModel(
          { blueprintId: drag.blueprintId, gridX: targetGx, gridY: targetGy },
          placementsRef.current,
          blueprintsMap,
          G,
          rotationsRef.current
        )
        canvas.style.cursor = drag.isValid ? 'grabbing' : 'not-allowed'
        draw()
        return
      }

      if (panDragging) {
        const view = viewRef.current
        view.panX += mx - panStartX
        view.panY += my - panStartY
        panStartX = mx
        panStartY = my
        draw()
        return
      }

      // 悬停感应（使用 ref 记录，避免鼠标微小位移导致整组件无休止重渲染与事件解绑）
      const hovered = findModelUnderPointer(worldPx, worldPy)
      if (hoveredIdRef.current !== hovered) {
        hoveredIdRef.current = hovered
        canvas.style.cursor = hovered ? 'grab' : 'default'
        draw()
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const drag = dragRef.current
      if (drag) {
        if (!drag.hasMoved) {
          // 点击事件：打开该模型的拍立得落成纪念卡
          onSelectModel?.(drag.blueprintId)
        } else if (drag.isValid) {
          // 允许放置：更新位置并播放轻脆咬合音效与实体落位触感
          onUpdatePlacement(drag.blueprintId, drag.currentGx, drag.currentGy)
          playSnapSound()
          triggerHaptic('medium')
        } else {
          // 碰撞重叠无法放置：给出双重警示触感
          triggerHaptic('warning')
        }
        // 若碰撞重叠 (drag.isValid === false)，自动回弹（丢弃本次无效移动）
        dragRef.current = null
        canvas.style.cursor = 'default'
        draw()
      }
      panDragging = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      applyWheelZoom(viewRef.current, e.clientX - rect.left, e.clientY - rect.top, e.deltaY)
      draw()
    }

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      const { worldPx, worldPy } = getScreenPoint(e as unknown as PointerEvent)
      const hitId = findModelUnderPointer(worldPx, worldPy)
      if (hitId && onModelContextMenu) {
        onModelContextMenu(hitId, e.clientX, e.clientY)
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', onContextMenu)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onContextMenu)
    }
  }, [blueprintsMap, onUpdatePlacement, onSelectModel, onModelContextMenu, draw, cfg, G])
  // 环境光照与重力视差偏好切换时触发重绘
  useEffect(() => {
    draw()
  }, [enableAmbient, enableGyroscope, draw])

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

  return (
    <canvas
      ref={canvasRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        touchAction: 'none'
      }}
    />
  )
}
