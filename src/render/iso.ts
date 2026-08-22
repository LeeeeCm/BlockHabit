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

function poly(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
}

export interface DrawCubeOptions {
  type?: BlockType
  /** 连击奖励块：点缀色描边 */
  bonus?: boolean
  /** 未放置的虚影 */
  ghost?: boolean
  /** 今日新落块高亮 */
  highlight?: boolean
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
  const { type = 'basic', bonus = false, ghost = false, highlight = false } = opts

  const top: Array<[number, number]> = [
    [sx, sy - h],
    [sx + w, sy],
    [sx, sy + h],
    [sx - w, sy],
  ]
  const left: Array<[number, number]> = [
    [sx - w, sy],
    [sx, sy + h],
    [sx, sy + h + bh],
    [sx - w, sy + bh],
  ]
  const right: Array<[number, number]> = [
    [sx + w, sy],
    [sx, sy + h],
    [sx, sy + h + bh],
    [sx + w, sy + bh],
  ]

  ctx.save()
  ctx.globalAlpha = ghost ? 0.15 : 1
  const fill = (pts: Array<[number, number]>, color: string) => {
    poly(ctx, pts)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = ghost ? p.ghost : p.line
    ctx.lineWidth = 1
    ctx.stroke()
  }

  fill(left, p.left)
  fill(right, p.right)
  fill(top, p.top)

  if (!ghost) decorate(ctx, sx, sy, c, p, type)

  if (bonus || highlight) {
    poly(ctx, [...top, ...left.slice(1), ...right.slice(1)])
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
      // 顶面立杆 + 点缀色小旗
      ctx.strokeStyle = p.line
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx, sy - bh * 0.9)
      ctx.stroke()
      ctx.fillStyle = p.accent
      poly(ctx, [
        [sx, sy - bh * 0.9],
        [sx + w * 0.7, sy - bh * 0.65],
        [sx, sy - bh * 0.4],
      ])
      ctx.fill()
      break
    }
    case 'window': {
      // 左右两面中央点缀色竖窗
      ctx.fillStyle = p.accent
      poly(ctx, [
        [sx - w * 0.45, sy + h * 0.35 + bh * 0.2],
        [sx - w * 0.15, sy + h * 0.65 + bh * 0.2],
        [sx - w * 0.15, sy + h * 0.65 + bh * 0.55],
        [sx - w * 0.45, sy + h * 0.35 + bh * 0.55],
      ])
      ctx.fill()
      break
    }
    case 'gate': {
      // 右面拱门（暗色）
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      poly(ctx, [
        [sx + w * 0.15, sy + h * 0.5 + bh * 0.15],
        [sx + w * 0.5, sy + h * 0.85 + bh * 0.15],
        [sx + w * 0.5, sy + h * 0.85 + bh * 0.85],
        [sx + w * 0.15, sy + h * 0.5 + bh * 0.85],
      ])
      ctx.fill()
      break
    }
    case 'chimney': {
      // 顶面点缀色圆环（烟囱口）
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
