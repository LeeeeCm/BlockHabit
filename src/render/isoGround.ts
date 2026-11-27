/**
 * 地基与接触阴影的绘制（E4 拆分自 iso.ts）。
 * 依赖几何原语与调色板；不依赖立方体绘制。
 */
import { withAlpha, type IsoPalette } from './isoColor'
import {
  rotateCoord,
  traceIsoGroundPath,
  worldToScreen,
  type IsoConfig,
  type IsoCornerRadii
} from './isoGeometry'

function groundBoundsOf(
  blocks: Array<{ x: number; y: number }>,
  rot: number = 0,
  cx: number = 0,
  cy: number = 0
) {
  // 全部楼层块的 x/y 包围盒（块坐标为格中心，外扩半格即水平占地范围；
  // 凸点水平投影位于格中心、半径小于半格宽，天然被包含）
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const b of blocks) {
    const { rx, ry } = rotateCoord(b.x, b.y, cx, cy, rot)
    minX = Math.min(minX, rx)
    maxX = Math.max(maxX, rx)
    minY = Math.min(minY, ry)
    maxY = Math.max(maxY, ry)
  }
  const margin = 1.0
  const x0 = minX - 0.5 - margin
  const x1 = maxX + 0.5 + margin
  const y0 = minY - 0.5 - margin
  const y1 = maxY + 0.5 + margin
  return { x0, x1, y0, y1 }
}

/** 底座层：虚线范围框 + 柔和填充（主体积木之下绘制） */
export function drawGroundBase(
  ctx: CanvasRenderingContext2D,
  blocks: Array<{ x: number; y: number }>,
  c: IsoConfig,
  p: IsoPalette,
  rot: number = 0,
  cx: number = 0,
  cy: number = 0
) {
  const { x0, x1, y0, y1 } = groundBoundsOf(blocks, rot, cx, cy)

  // 视角透视圆角阶梯：底角平缓舒展 (0.95) > 左右对称适中 (0.70) > 远端顶角紧凑自然 (0.50)
  const radii: IsoCornerRadii = {
    bottom: 0.95,
    side: 0.7,
    top: 0.5
  }

  ctx.save()
  traceIsoGroundPath(ctx, x0, x1, y0, y1, c, radii, c.blockH)
  ctx.fillStyle = 'rgba(128, 128, 128, 0.05)'
  ctx.fill()
  ctx.setLineDash([8, 6])
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = p.ghost
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.restore()
}

/** 地面接触阴影：建筑脚印内的柔和椭圆暗影（落地感），绘制于底座填充之上、积木之前 */
export function drawGroundShadow(
  ctx: CanvasRenderingContext2D,
  blocks: Array<{ x: number; y: number }>,
  c: IsoConfig,
  p: IsoPalette,
  rot: number = 0,
  cx: number = 0,
  cy: number = 0
) {
  if (blocks.length === 0) return
  const { x0, x1, y0, y1 } = groundBoundsOf(blocks, rot, cx, cy)
  // 底座 margin(1.0)+半格 0.5 之外再内缩一点，阴影落在脚印内部而非压到虚线框
  const inset = 1.05
  const fx0 = x0 + inset
  const fx1 = x1 - inset
  const fy0 = y0 + inset
  const fy1 = y1 - inset
  if (fx1 <= fx0 || fy1 <= fy0) return

  // 脚印矩形经等距投影后是菱形：中心取四角投影均值，
  // 内接椭圆半轴 = 菱形对角线的一半（横向 tileW、纵向 tileH），略收 92% 留出软边
  const corners = [
    worldToScreen(fx0, fy0, 0, c),
    worldToScreen(fx1, fy0, 0, c),
    worldToScreen(fx1, fy1, 0, c),
    worldToScreen(fx0, fy1, 0, c)
  ]
  const centerX = corners.reduce((s, pt) => s + pt.sx, 0) / 4
  const centerY = corners.reduce((s, pt) => s + pt.sy, 0) / 4
  const extent = (fx1 - fx0 + (fy1 - fy0)) / 2
  const halfW = Math.max(8, extent * (c.tileW / 2))
  const halfH = Math.max(4, extent * (c.tileH / 2))

  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.scale(1, halfH / halfW)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, halfW)
  g.addColorStop(0, withAlpha(p.ink, 0.12))
  g.addColorStop(0.65, withAlpha(p.ink, 0.05))
  g.addColorStop(1, withAlpha(p.ink, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, halfW, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
