import { useCallback, useEffect, useRef } from 'react'
import type { Blueprint, ShowcasePlacement } from '../types'
import {
  DEFAULT_ISO_CONFIG,
  drawCube,
  paletteFromDocument,
  traceIsoGroundPath,
  worldToScreen,
  type IsoCornerRadii,
} from './iso'
import {
  canPlaceModel,
  getModelFootprint,
  screenToGroundIso,
  SHOWCASE_GRID_SIZE,
} from '../logic/showcase'
import { playSnapSound } from '../audio/sound'
import {
  calculatePinchDistance,
  calculateTouchCenter,
  clampZoom,
  isQuickTap,
  type TouchGestureState,
} from './touchGesture'
import { triggerHaptic } from '../platform'
import { useAppStore } from '../store/appStore'

interface Props {
  placements: ShowcasePlacement[]
  blueprintsMap: Record<string, Blueprint>
  onUpdatePlacement: (blueprintId: string, gridX: number, gridY: number) => boolean
  onSelectModel?: (blueprintId: string) => void
}

interface DragState {
  blueprintId: string
  startGx: number
  startGy: number
  currentGx: number
  currentGy: number
  isValid: boolean
  hasMoved: boolean
  downPx: number
  downPy: number
}

/**
 * 展台沙盘（Showcase Island）：
 * 18×18 等距实体展台底座、多模型全局遮挡排序渲染、AABB 碰撞磁吸检测与无碰撞自由拖拽。
 */
export function ShowcaseScene({
  placements,
  blueprintsMap,
  onUpdatePlacement,
  onSelectModel,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef({ scale: 0.9, panX: 0, panY: 0, fitted: false })
  const dragRef = useRef<DragState | null>(null)
  const hoveredIdRef = useRef<string | null>(null)
  const enableAmbient = useAppStore((s) => s.settings.enableAmbientLighting !== false)
  const enableGyroscope = useAppStore((s) => Boolean(s.settings.enableGyroscope))
  const gyroOffsetRef = useRef({ x: 0, y: 0 })
  const settingsRef = useRef({ enableAmbient, enableGyroscope })
  settingsRef.current = { enableAmbient, enableGyroscope }

  const cfg = DEFAULT_ISO_CONFIG
  const G = SHOWCASE_GRID_SIZE

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
    const view = viewRef.current
    const gyro = gyroEnabled ? gyroOffsetRef.current : { x: 0, y: 0 }
    ctx.translate(view.panX + gyro.x, view.panY + gyro.y)
    ctx.scale(view.scale, view.scale)
    // 1. 展台底座（透视圆角实体托盘：底角最大平缓 > 左右对称第二大 > 顶角紧凑自然）
    const slabH = 12
    const radii: IsoCornerRadii = {
      bottom: 2.6, // 视点最近：最大圆角弧线，平缓饱满
      side: 2.1,   // 左右两侧：对称中等圆角，完全镜像一致
      top: 1.7,    // 远端顶角：优雅自然圆角，透视消逝感
    }

    // 采样顶面与底面的连续投影轮廓点集
    const STEPS = 20
    const topPts: { sx: number; sy: number }[] = []
    const botPts: { sx: number; sy: number }[] = []
    const addSample = (gx: number, gy: number) => {
      const s = worldToScreen(gx, gy, 0, cfg)
      topPts.push({ sx: s.sx, sy: s.sy + cfg.tileH / 2 })
      botPts.push({ sx: s.sx, sy: s.sy + cfg.tileH / 2 + slabH })
    }

    const rt = radii.top
    const rs = radii.side
    const rb = radii.bottom

    for (let i = 0; i <= STEPS; i++) {
      const a = (i / STEPS) * (Math.PI / 2)
      addSample(rt - rt * Math.cos(a), rt - rt * Math.sin(a))
    }
    for (let i = 0; i <= STEPS; i++) {
      const a = (i / STEPS) * (Math.PI / 2)
      addSample(G - rs + rs * Math.sin(a), rs - rs * Math.cos(a))
    }
    for (let i = 0; i <= STEPS; i++) {
      const a = (i / STEPS) * (Math.PI / 2)
      addSample(G - rb + rb * Math.cos(a), G - rb + rb * Math.sin(a))
    }
    for (let i = 0; i <= STEPS; i++) {
      const a = (i / STEPS) * (Math.PI / 2)
      addSample(rs - rs * Math.sin(a), G - rs + rs * Math.cos(a))
    }

    // 找到最左与最右切点位置，构建朝向相机的无缝连续 3D 侧裙面
    let leftIdx = 0
    let rightIdx = 0
    for (let i = 1; i < topPts.length; i++) {
      if (topPts[i].sx < topPts[leftIdx].sx) leftIdx = i
      if (topPts[i].sx > topPts[rightIdx].sx) rightIdx = i
    }

    const skirtPts: { sx: number; sy: number }[] = []
    if (leftIdx > rightIdx) {
      for (let i = rightIdx; i <= leftIdx; i++) skirtPts.push(topPts[i])
      for (let i = leftIdx; i >= rightIdx; i--) skirtPts.push(botPts[i])
    }

    // 底层环境光柔和阴影
    ctx.save()
    ctx.beginPath()
    botPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.sx, p.sy + 6) : ctx.lineTo(p.sx, p.sy + 6)))
    ctx.closePath()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)'
    ctx.fill()
    ctx.restore()

    // 朝向观众的 3D 侧面厚度（光滑连续曲面，绝无任何外溢线条）
    if (skirtPts.length > 0) {
      ctx.save()
      ctx.beginPath()
      skirtPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)))
      ctx.closePath()
      ctx.fillStyle = '#f1f5f9'
      ctx.fill()
      ctx.strokeStyle = palette.ink
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      ctx.stroke()
      ctx.restore()
    }

    // 展台顶面（纯白主体色 + 黑色外轮廓线）
    ctx.save()
    ctx.beginPath()
    topPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)))
    ctx.closePath()
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = palette.ink
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'
    ctx.stroke()

    // 裁剪在顶面内部绘制微弱对齐网格线
    ctx.clip()
    ctx.beginPath()
    for (let i = 1; i < G; i++) {
      const a = worldToScreen(i, 0, 0, cfg)
      const b = worldToScreen(i, G, 0, cfg)
      ctx.moveTo(a.sx, a.sy + cfg.tileH / 2)
      ctx.lineTo(b.sx, b.sy + cfg.tileH / 2)

      const c = worldToScreen(0, i, 0, cfg)
      const d = worldToScreen(G, i, 0, cfg)
      ctx.moveTo(c.sx, c.sy + cfg.tileH / 2)
      ctx.lineTo(d.sx, d.sy + cfg.tileH / 2)
    }
    ctx.strokeStyle = 'rgba(10, 10, 10, 0.08)'
    ctx.lineWidth = 0.8
    ctx.stroke()
    ctx.restore()
    // 3. 拖拽时地基磁吸 / 碰撞警告脚印
    const drag = dragRef.current
    if (drag) {
      const bp = blueprintsMap[drag.blueprintId]
      if (bp) {
        const fp = getModelFootprint(bp.blocks)
        const gx0 = drag.currentGx
        const gy0 = drag.currentGy
        const gx1 = gx0 + fp.width
        const gy1 = gy0 + fp.depth

        const dragRadii: IsoCornerRadii = {
          bottom: 0.9,
          side: 0.6,
          top: 0.35,
        }

        ctx.save()
        traceIsoGroundPath(ctx, gx0, gx1, gy0, gy1, cfg, dragRadii, cfg.tileH / 2)
        if (drag.isValid) {
          // 允许落位：柔和青绿吸附高光
          ctx.fillStyle = 'rgba(34, 197, 94, 0.22)'
          ctx.fill()
          ctx.strokeStyle = '#22c55e'
          ctx.lineWidth = 2
          ctx.stroke()
        } else {
          // 碰撞重叠或出界：柔和警示红
          ctx.fillStyle = 'rgba(239, 68, 68, 0.22)'
          ctx.fill()
          ctx.strokeStyle = '#ef4444'
          ctx.lineWidth = 2
          ctx.setLineDash([6, 4])
          ctx.stroke()
        }
        ctx.restore()
      }
    }

    // 4. 全局所有模型的积木混合深度排序（解决跨建筑相互遮挡）
    interface RenderCube {
      worldX: number
      worldY: number
      worldZ: number
      block: Blueprint['blocks'][0]
      blueprintId: string
      isDragging: boolean
    }

    const allCubes: RenderCube[] = []
    for (const p of placements) {
      const bp = blueprintsMap[p.blueprintId]
      if (!bp) continue
      const isDragging = drag?.blueprintId === p.blueprintId
      const gx = isDragging ? drag.currentGx : p.gridX
      const gy = isDragging ? drag.currentGy : p.gridY

      const fp = getModelFootprint(bp.blocks)
      for (const b of bp.blocks) {
        const wx = gx + (b.x - fp.minX)
        const wy = gy + (b.y - fp.minY)
        allCubes.push({
          worldX: wx,
          worldY: wy,
          worldZ: b.z,
          block: b,
          blueprintId: p.blueprintId,
          isDragging,
        })
      }
    }

    // Painter's 遮挡排序
    allCubes.sort((m, n) => {
      const a = m.worldX + m.worldY
      const c = n.worldX + n.worldY
      if (a !== c) return a - c
      return m.worldZ - n.worldZ
    })

    // 绘制所有积木
    for (const { worldX, worldY, worldZ, block, blueprintId, isDragging } of allCubes) {
      const { sx: px, sy: py } = worldToScreen(worldX, worldY, worldZ, cfg)
      const isHovered = hoveredIdRef.current === blueprintId && !drag
      drawCube(ctx, px, py + cfg.tileH / 2, cfg, palette, {
        type: block.type,
        color: block.color,
        highlight: isHovered,
        ghost: isDragging && !drag?.isValid,
      })
    }
  }, [placements, blueprintsMap, cfg, G])

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
        const p0 = worldToScreen(0, 0, 0, cfg)
        const pXY = worldToScreen(G, G, 0, cfg)
        const sceneW = (G * cfg.tileW)
        const sceneH = (G * cfg.tileH) + 120
        const scale = Math.min((w - 48) / sceneW, (h - 48) / sceneH, 1.2)
        viewRef.current = {
          scale,
          panX: w / 2 - ((p0.sx + pXY.sx) / 2) * scale,
          panY: h / 2 - ((p0.sy + pXY.sy) / 2) * scale - 20,
          fitted: true,
        }
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
      const rect = canvas.getBoundingClientRect()
      const mx = clientX - rect.left
      const my = clientY - rect.top
      const view = viewRef.current
      const worldPx = (mx - view.panX) / view.scale
      const worldPy = (my - view.panY) / view.scale - cfg.tileH / 2

      for (let i = placements.length - 1; i >= 0; i--) {
        const p = placements[i]
        const bp = blueprintsMap[p.blueprintId]
        if (!bp) continue
        const fp = getModelFootprint(bp.blocks)
        const { gx, gy } = screenToGroundIso(worldPx, worldPy, cfg.tileW, cfg.tileH)
        if (
          gx >= p.gridX - 0.4 &&
          gx <= p.gridX + fp.width + 0.4 &&
          gy >= p.gridY - 0.4 &&
          gy <= p.gridY + fp.depth + 0.4
        ) {
          return p.blueprintId
        }
      }
      return null
    },
    [placements, blueprintsMap, cfg.tileH, cfg.tileW],
  )

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
          const nextScale = clampZoom(view.scale * factor, 0.4, 2.5)

          const rect = canvas.getBoundingClientRect()
          const mx = center.x - rect.left
          const my = center.y - rect.top
          const panDx = center.x - state.lastPinchCenter.x
          const panDy = center.y - state.lastPinchCenter.y

          view.panX = mx - ((mx - view.panX) / view.scale) * nextScale + panDx
          view.panY = my - ((my - view.panY) / view.scale) * nextScale + panDy
          view.scale = nextScale

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
        if (isQuickTap(duration, state.maxDisplacement)) {
          const hitId = findModelAtScreenPoint(state.startX, state.startY)
          if (hitId) {
            triggerHaptic('light')
            onSelectModel?.(hitId)
          }
        }
        touchStateRef.current = null
      } else if (e.touches.length === 1) {
        const t = e.touches[0]
        state.isMultiTouch = false
        state.lastX = t.clientX
        state.lastY = t.clientY
        state.lastPinchDist = 0
        state.maxDisplacement = 999
      } else if (e.touches.length >= 2) {
        state.lastPinchDist = calculatePinchDistance(e.touches[0], e.touches[1])
        state.lastPinchCenter = calculateTouchCenter(e.touches[0], e.touches[1])
        state.maxDisplacement = 999
      }
    },
    [findModelAtScreenPoint, onSelectModel],
  )

  const handleTouchCancel = useCallback(() => {
    touchStateRef.current = null
  }, [])

  // 鼠标交互：拖拽移动、碰撞反馈与点击选中
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let panDragging = false
    let panStartX = 0
    let panStartY = 0

    function getScreenPoint(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const view = viewRef.current
      const worldPx = (mx - view.panX) / view.scale
      const worldPy = (my - view.panY) / view.scale - cfg.tileH / 2
      return { mx, my, worldPx, worldPy }
    }

    function findModelUnderPointer(worldPx: number, worldPy: number): string | null {
      // 从后往前检测模型
      for (let i = placements.length - 1; i >= 0; i--) {
        const p = placements[i]
        const bp = blueprintsMap[p.blueprintId]
        if (!bp) continue
        const fp = getModelFootprint(bp.blocks)
        const { gx, gy } = screenToGroundIso(worldPx, worldPy, cfg.tileW, cfg.tileH)
        if (
          gx >= p.gridX - 0.4 &&
          gx <= p.gridX + fp.width + 0.4 &&
          gy >= p.gridY - 0.4 &&
          gy <= p.gridY + fp.depth + 0.4
        ) {
          return p.blueprintId
        }
      }
      return null
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      canvas.setPointerCapture(e.pointerId)
      const { mx, my, worldPx, worldPy } = getScreenPoint(e)
      const hitId = findModelUnderPointer(worldPx, worldPy)

      if (hitId) {
        // 命中建筑模型：进入模型拖拽状态
        const p = placements.find((x) => x.blueprintId === hitId)!
        dragRef.current = {
          blueprintId: hitId,
          startGx: p.gridX,
          startGy: p.gridY,
          currentGx: p.gridX,
          currentGy: p.gridY,
          isValid: true,
          hasMoved: false,
          downPx: mx,
          downPy: my,
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
        const fp = bp ? getModelFootprint(bp.blocks) : { width: 1, depth: 1 }

        // 磁吸对齐至整数网格坐标
        const targetGx = Math.max(0, Math.min(G - fp.width, Math.round(gx - fp.width / 2)))
        const targetGy = Math.max(0, Math.min(G - fp.depth, Math.round(gy - fp.depth / 2)))

        drag.currentGx = targetGx
        drag.currentGy = targetGy
        drag.isValid = canPlaceModel(
          { blueprintId: drag.blueprintId, gridX: targetGx, gridY: targetGy },
          placements,
          blueprintsMap,
          G,
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
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const view = viewRef.current
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const next = Math.min(2.5, Math.max(0.4, view.scale * factor))
      view.panX = mx - ((mx - view.panX) / view.scale) * next
      view.panY = my - ((my - view.panY) / view.scale) * next
      view.scale = next
      draw()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [placements, blueprintsMap, onUpdatePlacement, onSelectModel, draw, cfg, G])
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
        y: gyroOffsetRef.current.y * 0.8 + targetY * 0.2,
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
        touchAction: 'none',
      }}
    />
  )
}
