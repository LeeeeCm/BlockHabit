import type { Blueprint } from '../../types'
import { DEFAULT_ISO_CONFIG, followResize, isPointInsideCube, worldToScreen } from '../iso'
import { blendBounds, framingWeight, measureBounds, type ViewBounds } from '../framing'
import { computeFitView } from '../sceneCamera'
import {
  calculatePinchDistance,
  calculateTouchCenter,
  clampZoom,
  type TouchGestureState,
  type TouchPoint
} from '../touchGesture'
import type { BlockMeta, CubeEntry, HoveredBlock, SceneState, ViewState } from './sceneTypes'

/**
 * 建造场景的相机与手势数学（拆分自 BuildScene.tsx）：
 * 取景包围盒 / 自适应拟合 / 尺寸跟随、命中检测、拖拽缩放、触摸手势状态迁移。
 * 全部为纯函数或对传入对象（view / gesture state）的原地更新，不读组件闭包。
 */

/** 整座蓝图的中心：旋转轴必须固定，否则取景范围变化时模型会横向漂移 */
export function blueprintCenter(blueprint: Blueprint): { cx: number; cy: number } {
  let minBx = Infinity
  let maxBx = -Infinity
  let minBy = Infinity
  let maxBy = -Infinity
  for (const b of blueprint.blocks) {
    minBx = Math.min(minBx, b.x)
    maxBx = Math.max(maxBx, b.x)
    minBy = Math.min(minBy, b.y)
    maxBy = Math.max(maxBy, b.y)
  }
  return { cx: Math.round((minBx + maxBx) / 2), cy: Math.round((minBy + maxBy) / 2) }
}

/**
 * 取景包围盒（D10）：开荒期只框住「已放置的积木」，让第一块就有存在感；
 * 随进度用 smoothstep 平滑过渡到整座蓝图（含地基虚线），建成期能看到全貌。
 */
export function sceneBounds(state: SceneState): { bounds: ViewBounds; allBounds: ViewBounds } {
  const { blueprint: bp, rotation: rot, placedCount: pc } = state
  const { cx, cy } = blueprintCenter(bp)
  const all = measureBounds(bp.blocks, cx, cy, rot)
  if (pc <= 0) return { bounds: all, allBounds: all }
  const placed = measureBounds(bp.blocks.slice(0, pc), cx, cy, rot)
  const bounds = blendBounds(placed, all, framingWeight(pc, bp.blocks.length))
  return { bounds, allBounds: all }
}

/** 自适应取景（E5：取景数学抽到 sceneCamera；D10 的两条上限仍在纯函数里） */
export function fitSceneView(state: SceneState, width: number, height: number): ViewState {
  const { bounds, allBounds } = sceneBounds(state)
  return {
    ...computeFitView({ bounds, allBounds, width, height }),
    fitted: true
  }
}

/** 已手动取景后窗口尺寸变化：模型随窗口等比缩放并保持窗口内相对位置 */
export function followSceneResize(
  view: ViewState,
  prev: { w: number; h: number },
  next: { w: number; h: number },
  state: SceneState
): ViewState {
  const { bounds } = sceneBounds(state)
  return {
    ...followResize(
      view,
      { w: prev.w, h: prev.h },
      { w: next.w, h: next.h },
      { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
    ),
    fitted: view.fitted
  }
}

/** 客户端坐标 → 场景坐标（先减去画布偏移，再逆变换 pan / scale） */
export function scenePointFromClient(
  rect: { left: number; top: number },
  view: ViewState,
  clientX: number,
  clientY: number
): { mx: number; my: number } {
  return {
    mx: (clientX - rect.left - view.panX) / view.scale,
    my: (clientY - rect.top - view.panY) / view.scale
  }
}

/** 命中检测：从绘制顺序末尾（最上层）向前找第一个落在已放置积木内的块 */
export function hitTestCube(
  cubes: CubeEntry[],
  placedCount: number,
  mx: number,
  my: number
): CubeEntry | null {
  const cfg = DEFAULT_ISO_CONFIG
  for (let k = cubes.length - 1; k >= 0; k--) {
    const item = cubes[k]
    if (item.i >= placedCount) continue
    const { sx, sy } = worldToScreen(item.rx, item.ry, item.b.z, cfg)
    if (isPointInsideCube(mx, my, sx, sy, cfg)) {
      return item
    }
  }
  return null
}

/** 指针 / 轻点命中的积木 → 读砖气泡数据（文案回退顺序：习惯名 → 已删除 → 奖励块 → 占位） */
export function buildHoveredBlock(
  index: number,
  pos: { x: number; y: number },
  meta: BlockMeta | undefined,
  labels: { bonusHabit: string; deletedHabit: string }
): HoveredBlock {
  const ci = meta?.ci
  return {
    index,
    x: pos.x,
    y: pos.y,
    habitName:
      meta?.habitName || (ci ? labels.deletedHabit : meta?.pb?.bonus ? labels.bonusHabit : '—'),
    date: ci?.date || '',
    note: ci?.note,
    mood: ci?.mood,
    starred: ci?.starred
  }
}

/** 以屏幕点 (mx, my) 为锚点缩放到 nextScale（滚轮 / 双指共用同一套变换） */
export function applyZoomAt(view: ViewState, mx: number, my: number, nextScale: number) {
  view.panX = mx - ((mx - view.panX) / view.scale) * nextScale
  view.panY = my - ((my - view.panY) / view.scale) * nextScale
  view.scale = nextScale
}

/** 双指缩放：锚点取双指中点，并跟随中点位移做平移 */
export function applyPinchZoom(
  view: ViewState,
  center: { x: number; y: number },
  lastCenter: { x: number; y: number },
  rect: { left: number; top: number },
  nextScale: number
) {
  const mx = center.x - rect.left
  const my = center.y - rect.top
  const panDx = center.x - lastCenter.x
  const panDy = center.y - lastCenter.y
  view.panX = mx - ((mx - view.panX) / view.scale) * nextScale + panDx
  view.panY = my - ((my - view.panY) / view.scale) * nextScale + panDy
  view.scale = nextScale
}

/** 单指落下：初始化手势状态 */
export function beginSingleTouch(point: TouchPoint): TouchGestureState {
  return {
    startTime: performance.now(),
    startX: point.clientX,
    startY: point.clientY,
    lastX: point.clientX,
    lastY: point.clientY,
    maxDisplacement: 0,
    isMultiTouch: false,
    lastPinchDist: 0,
    lastPinchCenter: { x: point.clientX, y: point.clientY }
  }
}

/** 多指落下：已有手势状态则标记为多点，否则以双指中点初始化 */
export function beginMultiTouch(
  p1: TouchPoint,
  p2: TouchPoint,
  prev: TouchGestureState | null
): TouchGestureState {
  const dist = calculatePinchDistance(p1, p2)
  const center = calculateTouchCenter(p1, p2)
  if (prev) {
    prev.isMultiTouch = true
    prev.lastPinchDist = dist
    prev.lastPinchCenter = center
    prev.maxDisplacement = 999
    return prev
  }
  return {
    startTime: performance.now(),
    startX: center.x,
    startY: center.y,
    lastX: center.x,
    lastY: center.y,
    maxDisplacement: 999,
    isMultiTouch: true,
    lastPinchDist: dist,
    lastPinchCenter: center
  }
}

/** 单指拖动：更新 last 坐标与最大位移，返回本帧增量 */
export function dragSingleTouch(
  state: TouchGestureState,
  point: TouchPoint
): { dx: number; dy: number } {
  const dx = point.clientX - state.lastX
  const dy = point.clientY - state.lastY
  state.lastX = point.clientX
  state.lastY = point.clientY
  const disp = Math.hypot(point.clientX - state.startX, point.clientY - state.startY)
  if (disp > state.maxDisplacement) {
    state.maxDisplacement = disp
  }
  return { dx, dy }
}

/** 双指移动：有上一帧距离时按比例缩放，返回是否发生了缩放 */
export function pinchMove(
  state: TouchGestureState,
  p1: TouchPoint,
  p2: TouchPoint,
  view: ViewState,
  canvas: HTMLCanvasElement
): boolean {
  state.isMultiTouch = true
  state.maxDisplacement = 999
  const dist = calculatePinchDistance(p1, p2)
  const center = calculateTouchCenter(p1, p2)
  let zoomed = false
  if (state.lastPinchDist > 0) {
    const rect = canvas.getBoundingClientRect()
    const nextScale = clampZoom(view.scale * (dist / state.lastPinchDist), 0.5, 3.0)
    applyPinchZoom(view, center, state.lastPinchCenter, rect, nextScale)
    zoomed = true
  }
  state.lastPinchDist = dist
  state.lastPinchCenter = center
  return zoomed
}

/** 抬起一指后回到单指模式，并以剩余手指重新锚定起点 */
export function retargetSingleTouch(state: TouchGestureState, point: TouchPoint) {
  state.isMultiTouch = false
  state.startX = point.clientX
  state.startY = point.clientY
  state.lastX = point.clientX
  state.lastY = point.clientY
  state.lastPinchDist = 0
  state.maxDisplacement = 999
}

/** 仍是多指（抬起一指但剩 >=2 指）时只更新双指中点 */
export function retargetMultiTouch(state: TouchGestureState, p1: TouchPoint, p2: TouchPoint) {
  state.lastPinchCenter = calculateTouchCenter(p1, p2)
  state.maxDisplacement = 999
}
