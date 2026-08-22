import type { BlockType } from '../types'

export interface IsoConfig {
  tileW: number
  tileH: number
  blockH: number
}

export interface IsoPalette {
  top: string
  left: string
  right: string
  ghost: string
  line: string
  accent: string
}

/** 世界坐标 → 屏幕坐标：(sx, sy) 为该立方体顶面菱形中心 */
export function worldToScreen(x: number, y: number, z: number, c: IsoConfig) {
  return {
    sx: (x - y) * (c.tileW / 2),
    sy: (x + y) * (c.tileH / 2) - z * c.blockH,
  }
}

/** 画家算法排序键：值小者先画（被后画者覆盖） */
export const depth = (x: number, y: number, z: number): number => x + y + z

export const DEFAULT_ISO_CONFIG: IsoConfig = { tileW: 48, tileH: 24, blockH: 20 }

type Pt = [number, number]

/** 多边形圆角路径（arcTo 收角），r 为屏幕像素半径 */
function roundedPoly(ctx: CanvasRenderingContext2D, pts: Pt[], r: number) {
  const n = pts.length
  const clamped: number[] = []
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const prev = pts[(i - 1 + n) % n]
    const next = pts[(i + 1) % n]
    const l1 = Math.hypot(p[0] - prev[0], p[1] - prev[1])
    const l2 = Math.hypot(next[0] - p[0], next[1] - p[1])
    clamped.push(Math.min(r, l1 / 2, l2 / 2))
  }
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const next = pts[(i + 1) % n]
    const rI = clamped[i]
    const v1: Pt = [p[0] - pts[(i - 1 + n) % n][0], p[1] - pts[(i - 1 + n) % n][1]]
    const v2: Pt = [next[0] - p[0], next[1] - p[1]]
    const m1 = Math.hypot(v1[0], v1[1]) || 1
    const m2 = Math.hypot(v2[0], v2[1]) || 1
    const a: Pt = [p[0] - (v1[0] / m1) * rI, p[1] - (v1[1] / m1) * rI]
    const b: Pt = [p[0] + (v2[0] / m2) * rI, p[1] + (v2[1] / m2) * rI]
    if (i === 0) ctx.moveTo(a[0], a[1])
    else ctx.lineTo(a[0], a[1])
    ctx.arcTo(p[0], p[1], b[0], b[1], rI)
  }
  ctx.closePath()
}

export interface DrawCubeOptions {
  type?: BlockType
  /** 连击奖励块：点缀色描边 */
  bonus?: boolean
  /** 虚影绘制（不再用于建造页，保留给预览等场景） */
  ghost?: boolean
  /** 高亮描边 */
  highlight?: boolean
  /** 不画乐高凸点（顶上有方块时省略） */
  noStuds?: boolean
}

/** 乐高凸点：顶面上的小圆柱 */
function drawStud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  h: number,
  sideColor: string,
  topColor: string,
  line: string,
) {
  // 侧面
  ctx.beginPath()
  ctx.moveTo(cx - rx, cy)
  ctx.lineTo(cx - rx, cy - h)
  ctx.ellipse(cx, cy - h, rx, ry, 0, Math.PI, 0, true)
  ctx.lineTo(cx + rx, cy)
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI)
  ctx.closePath()
  ctx.fillStyle = sideColor
  ctx.fill()
  ctx.strokeStyle = line
  ctx.lineWidth = 1
  ctx.stroke()
  // 顶面
  ctx.beginPath()
  ctx.ellipse(cx, cy - h, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = topColor
  ctx.fill()
  ctx.stroke()
}

export function drawCube(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  c: IsoConfig,
  p: IsoPalette,
  opts: DrawCubeOptions = {},
) {
  const w = c.tileW / 2
  const h = c.tileH / 2
  const bh = c.blockH
  const { type = 'basic', bonus = false, ghost = false, highlight = false, noStuds = false } = opts

  const cornerR = Math.max(3, c.tileW * 0.1)
  const top: Pt[] = [
    [sx, sy - h],
    [sx + w, sy],
    [sx, sy + h],
    [sx - w, sy],
  ]
  const left: Pt[] = [
    [sx - w, sy],
    [sx, sy + h],
    [sx, sy + h + bh],
    [sx - w, sy + bh],
  ]
  const right: Pt[] = [
    [sx + w, sy],
    [sx, sy + h],
    [sx, sy + h + bh],
    [sx + w, sy + bh],
  ]

  ctx.save()
  ctx.globalAlpha = ghost ? 0.15 : 1
  const fill = (pts: Pt[], color: string, r: number) => {
    roundedPoly(ctx, pts, r)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = ghost ? p.ghost : p.line
    ctx.lineWidth = 1
    ctx.stroke()
  }

  fill(left, p.left, cornerR)
  fill(right, p.right, cornerR)
  fill(top, p.top, cornerR)

  if (!ghost && !noStuds) {
    drawStud(ctx, sx, sy, w * 0.3, h * 0.3, bh * 0.22, p.left, p.top, p.line)
  }

  if (!ghost) decorate(ctx, sx, sy, c, p, type)

  if (bonus || highlight) {
    roundedPoly(ctx, top, cornerR)
    ctx.strokeStyle = p.accent
    ctx.lineWidth = highlight ? 2.5 : 1.5
    ctx.stroke()
  }
  ctx.restore()
}

function decorate(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  c: IsoConfig,
  p: IsoPalette,
  type: BlockType,
) {
  const w = c.tileW / 2
  const h = c.tileH / 2
  const bh = c.blockH
  switch (type) {
    case 'flag': {
      ctx.strokeStyle = p.line
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx, sy - bh * 0.9)
      ctx.stroke()
      ctx.fillStyle = p.accent
      ctx.beginPath()
      ctx.moveTo(sx, sy - bh * 0.9)
      ctx.lineTo(sx + w * 0.7, sy - bh * 0.65)
      ctx.lineTo(sx, sy - bh * 0.4)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'window': {
      ctx.fillStyle = p.accent
      roundedPoly(
        ctx,
        [
          [sx - w * 0.45, sy + h * 0.35 + bh * 0.2],
          [sx - w * 0.15, sy + h * 0.65 + bh * 0.2],
          [sx - w * 0.15, sy + h * 0.65 + bh * 0.55],
          [sx - w * 0.45, sy + h * 0.35 + bh * 0.55],
        ],
        3,
      )
      ctx.fill()
      break
    }
    case 'gate': {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      roundedPoly(
        ctx,
        [
          [sx + w * 0.15, sy + h * 0.5 + bh * 0.15],
          [sx + w * 0.5, sy + h * 0.85 + bh * 0.15],
          [sx + w * 0.5, sy + h * 0.85 + bh * 0.85],
          [sx + w * 0.15, sy + h * 0.5 + bh * 0.85],
        ],
        4,
      )
      ctx.fill()
      break
    }
    case 'chimney': {
      ctx.strokeStyle = p.accent
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(sx, sy, w * 0.35, h * 0.35, 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    default:
      break
  }
}

/** 蓝图地面范围：虚线圆角菱形（只标长宽，不画虚影积木） */
export function drawGroundBounds(
  ctx: CanvasRenderingContext2D,
  blocks: Array<{ x: number; y: number }>,
  c: IsoConfig,
  p: IsoPalette,
) {
  if (blocks.length === 0) return
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const b of blocks) {
    minX = Math.min(minX, b.x)
    maxX = Math.max(maxX, b.x)
    minY = Math.min(minY, b.y)
    maxY = Math.max(maxY, b.y)
  }
  const x0 = minX - 0.5
  const x1 = maxX + 0.5
  const y0 = minY - 0.5
  const y1 = maxY + 0.5
  const corners = [
    worldToScreen(x0, y0, 0, c),
    worldToScreen(x1, y0, 0, c),
    worldToScreen(x1, y1, 0, c),
    worldToScreen(x0, y1, 0, c),
  ]
  const pts: Pt[] = corners.map((c2) => [c2.sx, c2.sy] as Pt)
  ctx.save()
  roundedPoly(ctx, pts, 14)
  ctx.fillStyle = 'rgba(128,128,128,0.06)'
  ctx.fill()
  ctx.setLineDash([9, 7])
  ctx.strokeStyle = p.ghost
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()
}

/** 从 CSS 变量读取当前主题的调色板 */
export function paletteFromDocument(doc: Document = document): IsoPalette {
  const s = getComputedStyle(doc.documentElement)
  const v = (name: string) => s.getPropertyValue(name).trim()
  return {
    top: v('--block-top'),
    left: v('--block-left'),
    right: v('--block-right'),
    ghost: v('--block-ghost'),
    line: v('--line'),
    accent: v('--accent'),
  }
}
