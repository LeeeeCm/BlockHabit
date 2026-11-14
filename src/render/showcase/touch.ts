/**
 * 展台手势的纯状态搬运（拆分自 ShowcaseScene.tsx）：
 * 按下初始化、单指平移累计、抬手后的留守触点同步。
 * 真正的 view 变换与重绘编排仍留在组件。
 */
import {
  calculatePinchDistance,
  calculateTouchCenter,
  type TouchGestureState,
  type TouchPoint
} from '../touchGesture'

interface TouchListLike {
  readonly length: number
  readonly [index: number]: TouchPoint
}

/** 单指按下：初始化手势状态（起点 = 当前位置） */
export function beginSingleTouch(t: TouchPoint): TouchGestureState {
  return {
    startTime: performance.now(),
    startX: t.clientX,
    startY: t.clientY,
    lastX: t.clientX,
    lastY: t.clientY,
    maxDisplacement: 0,
    isMultiTouch: false,
    lastPinchDist: 0,
    lastPinchCenter: { x: t.clientX, y: t.clientY }
  }
}

/** 双指按下：复用已有手势（标记多点）或新建多点手势 */
export function beginMultiTouch(
  state: TouchGestureState | null,
  p1: TouchPoint,
  p2: TouchPoint
): TouchGestureState {
  const dist = calculatePinchDistance(p1, p2)
  const center = calculateTouchCenter(p1, p2)
  if (state) {
    state.isMultiTouch = true
    state.lastPinchDist = dist
    state.lastPinchCenter = center
    state.maxDisplacement = 999
    return state
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

/** 单指平移：返回本次局部位移，并累计最大位移（快速点击判定用） */
export function trackSingleTouchPan(
  state: TouchGestureState,
  t: TouchPoint
): { dx: number; dy: number } {
  const dx = t.clientX - state.lastX
  const dy = t.clientY - state.lastY
  state.lastX = t.clientX
  state.lastY = t.clientY
  const disp = Math.hypot(t.clientX - state.startX, t.clientY - state.startY)
  if (disp > state.maxDisplacement) {
    state.maxDisplacement = disp
  }
  return { dx, dy }
}

/** 抬手后仍有手指留在屏上：同步剩余触点；返回是否已全部抬起 */
export function endTouchGesture(state: TouchGestureState, touches: TouchListLike): boolean {
  if (touches.length === 0) return true
  if (touches.length === 1) {
    const t = touches[0]
    state.isMultiTouch = false
    state.lastX = t.clientX
    state.lastY = t.clientY
    state.lastPinchDist = 0
    state.maxDisplacement = 999
  } else if (touches.length >= 2) {
    state.lastPinchDist = calculatePinchDistance(touches[0], touches[1])
    state.lastPinchCenter = calculateTouchCenter(touches[0], touches[1])
    state.maxDisplacement = 999
  }
  return false
}
