export interface TouchPoint {
  clientX: number
  clientY: number
}

export interface TouchGestureState {
  startTime: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  maxDisplacement: number
  isMultiTouch: boolean
  lastPinchDist: number
  lastPinchCenter: { x: number; y: number }
}

/**
 * Calculates Euclidean distance between two touch points.
 */
export function calculatePinchDistance(p1: TouchPoint, p2: TouchPoint): number {
  return Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY)
}

/**
 * Calculates the midpoint between two touch points.
 */
export function calculateTouchCenter(p1: TouchPoint, p2: TouchPoint): { x: number; y: number } {
  return {
    x: (p1.clientX + p2.clientX) / 2,
    y: (p1.clientY + p2.clientY) / 2
  }
}

/**
 * Clamps a zoom scale within specified bounds (default 0.5 to 3.0).
 */
export function clampZoom(scale: number, minScale = 0.5, maxScale = 3.0): number {
  return Math.min(maxScale, Math.max(minScale, scale))
}

/**
 * Determines whether a touch interaction qualifies as a quick tap (< 250ms and < 8px displacement).
 */
export function isQuickTap(
  durationMs: number,
  displacementPx: number,
  maxDuration = 250,
  maxDisplacement = 8
): boolean {
  return durationMs < maxDuration && displacementPx < maxDisplacement
}
