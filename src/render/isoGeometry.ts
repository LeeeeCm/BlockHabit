/**
 * 等距投影与几何原语（E4 拆分自 iso.ts）：坐标变换、圆角路径、旋转与视口跟随。
 * 纯函数，不依赖画布状态，也不依赖任何绘制逻辑。
 */

export interface IsoConfig {
  tileW: number
  tileH: number
  blockH: number
}

/** 世界坐标 → 屏幕坐标：(sx, sy) 为该立方体顶面菱形中心 */
export function worldToScreen(x: number, y: number, z: number, c: IsoConfig) {
  return {
    sx: (x - y) * (c.tileW / 2),
    sy: (x + y) * (c.tileH / 2) - z * c.blockH
  }
}

/** 绕中心点 (cx, cy) 步进 90° 旋转坐标，rot 为象限序号 (0=0°, 1=90°, 2=180°, 3=270°) */
export function rotateCoord(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rot: number
): { rx: number; ry: number } {
  const q = ((rot % 4) + 4) % 4
  const dx = x - cx
  const dy = y - cy
  switch (q) {
    case 1:
      return { rx: cx - dy, ry: cy + dx }
    case 2:
      return { rx: cx - dx, ry: cy - dy }
    case 3:
      return { rx: cx + dy, ry: cy - dx }
    default:
      return { rx: x, ry: y }
  }
}

/** 画家算法排序键：值小者先画（被后画者覆盖）。仅测试保留，实际排序见 BuildScene */
export const depth = (x: number, y: number, z: number): number => x + y + z

/** 块身高度：宽:深:高 = 1:1:1.2 投影换算；顶部凸点层另加高 STUD_H */
export const DEFAULT_ISO_CONFIG: IsoConfig = { tileW: 48, tileH: 24, blockH: 29 }
/** 凸点圆柱高度（真实乐高含凸点比例） */
export const STUD_H = 5

/* ---------------- 视图随窗口变化 ---------------- */

/** 画布视图：screen = iso 坐标 × scale + pan */
export interface IsoView {
  scale: number
  panX: number
  panY: number
}

/**
 * 窗口尺寸变化（最大化/还原/拖拽窗口边缘）后的视图跟随，用于用户已手动取景的场景：
 * 模型随窗口等比缩放（按宽高面积比的平方根，最大化再还原是精确逆变换），
 * 模型中心保持在窗口中的相对位置。
 * center 为模型包围盒中心（等距平面坐标），缩放钳制范围与滚轮缩放一致 [0.3, 3]。
 */
export function followResize(
  view: IsoView,
  prev: { w: number; h: number },
  next: { w: number; h: number },
  center: { x: number; y: number }
): IsoView {
  const relX = (view.panX + center.x * view.scale) / prev.w
  const relY = (view.panY + center.y * view.scale) / prev.h
  const scale = Math.min(
    3,
    Math.max(0.3, view.scale * Math.sqrt((next.w * next.h) / (prev.w * prev.h)))
  )
  return {
    scale,
    panX: relX * next.w - center.x * scale,
    panY: relY * next.h - center.y * scale
  }
}

export type Pt = [number, number]

/* ---------------- 几何工具 ---------------- */

/** 多边形圆角路径（标准无伪影 arcTo 连续收角）；r 为统一半径或逐顶点半径数组 */
export function roundedPoly(ctx: CanvasRenderingContext2D, pts: Pt[], r: number | number[]) {
  const n = pts.length
  if (n < 3) return
  const rAt = (i: number) => (typeof r === 'number' ? r : (r[i] ?? r[0]))

  // 从最后一条边 (n-1 -> 0) 的中点开始作为起始点，保证 arcTo 自动算切点且无尖角伪影
  const pLast = pts[n - 1]
  const pFirst = pts[0]
  const midX = (pLast[0] + pFirst[0]) / 2
  const midY = (pLast[1] + pFirst[1]) / 2

  ctx.beginPath()
  ctx.moveTo(midX, midY)

  for (let i = 0; i < n; i++) {
    const corner = pts[i]
    const next = pts[(i + 1) % n]
    const prev = pts[(i - 1 + n) % n]
    const l1 = Math.hypot(corner[0] - prev[0], corner[1] - prev[1])
    const l2 = Math.hypot(next[0] - corner[0], next[1] - corner[1])
    const maxR = Math.min(rAt(i), l1 / 2, l2 / 2)
    ctx.arcTo(corner[0], corner[1], next[0], next[1], maxR)
  }
  ctx.closePath()
}

export interface IsoCornerRadii {
  top: number
  side: number
  bottom: number
}

/**
 * 严格符合 3D 等距透视层级的水平圆角路径生成器：
 * - 底角 (Bottom)：面向视点最近，呈现最宽大的等距椭圆弧；
 * - 左右角 (Side)：对称中等弧度，完全镜像一致；
 * - 顶角 (Top)：远端消逝方向，呈现最小紧凑弧度。
 * 全曲线在 3D 轴系网格中生成后投影，具有天然 2:1 椭圆透视，绝无 2D 圆弧畸变与虚线折角瑕疵。
 */
export function traceIsoGroundPath(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  c: IsoConfig,
  radii: IsoCornerRadii,
  yOffset: number = 0
) {
  const STEPS = 16
  const maxAllow = Math.min((x1 - x0) / 2.2, (y1 - y0) / 2.2)
  const rt = Math.max(0.01, Math.min(radii.top, maxAllow))
  const rs = Math.max(0.01, Math.min(radii.side, maxAllow))
  const rb = Math.max(0.01, Math.min(radii.bottom, maxAllow))

  ctx.beginPath()
  let first = true

  const pt = (gx: number, gy: number) => {
    const { sx, sy } = worldToScreen(gx, gy, 0, c)
    if (first) {
      ctx.moveTo(sx, sy + yOffset)
      first = false
    } else {
      ctx.lineTo(sx, sy + yOffset)
    }
  }

  // 1. 远端顶角 C0（弧形最小，由左向右转）
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2)
    pt(x0 + rt - rt * Math.cos(a), y0 + rt - rt * Math.sin(a))
  }

  // 2. 右侧角 C1（左右对称中等弧度，由上向下转）
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2)
    pt(x1 - rs + rs * Math.sin(a), y0 + rs - rs * Math.cos(a))
  }

  // 3. 近端底角 C2（最前方面向视点，弧形最大最平缓，由右向左转）
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2)
    pt(x1 - rb + rb * Math.cos(a), y1 - rb + rb * Math.sin(a))
  }

  // 4. 左侧角 C3（与右侧完全对称相同弧度，由下向上转）
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2)
    pt(x0 + rs - rs * Math.sin(a), y1 - rs + rs * Math.cos(a))
  }

  ctx.closePath()
}
