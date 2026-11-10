/**
 * 地基、接触阴影与微生态植被的绘制（E4 拆分自 iso.ts）。
 * 依赖立方体绘制（植被是缩小版的积木）与几何原语。
 */
import { withAlpha, type IsoPalette } from './isoColor'
import {
  rotateCoord,
  traceIsoGroundPath,
  worldToScreen,
  type IsoConfig,
  type IsoCornerRadii
} from './isoGeometry'
import { drawCube } from './isoCube'

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

/** 植被层：连胜微生态彩蛋——底座 margin 环带（积木脚印之外）随连胜阶段生长的积木风迷你植被
 *  （阶段 1 萌芽 ≥1 天 / 2 积木小径 ≥7 天 / 3 积木树 ≥21 天 / 4 积木花园 ≥100 天）
 *  在主体积木之后绘制（前景层），避免被积木精灵覆盖。 */
export function drawEcoProps(
  ctx: CanvasRenderingContext2D,
  blocks: Array<{ x: number; y: number }>,
  c: IsoConfig,
  p: IsoPalette,
  rot: number = 0,
  cx: number = 0,
  cy: number = 0,
  ecoStage = 0,
  layer: 'back' | 'front' = 'front'
) {
  if (ecoStage < 1 || blocks.length < 2) return
  const { x0, x1, y0, y1 } = groundBoundsOf(blocks, rot, cx, cy)
  const mini: IsoConfig = { ...c, tileW: 16, tileH: 8, blockH: 7 }
  const flora: IsoPalette = {
    ...p,
    top: '#8fce8f',
    left: '#57a457',
    right: '#2f7d3a',
    ink: 'rgba(24, 58, 32, 0.55)'
  }
  const stone: IsoPalette = {
    ...flora,
    top: '#d6d3d1',
    left: '#a8a29e',
    right: '#78716c',
    ink: 'rgba(60,55,50,0.4)'
  }
  const bloom: IsoPalette = { ...flora, top: '#f5b301', left: '#d99e00', right: '#b58500' }
  const put = (wx: number, wy: number, pal: IsoPalette, stack = 1) => {
    const { sx, sy } = worldToScreen(wx, wy, 0, c)
    for (let k = 0; k < stack; k++) {
      drawCube(ctx, sx, sy + c.tileH / 2 - k * mini.blockH, mini, pal, { noStuds: true })
    }
  }
  const midX = (x0 + x1) / 2
  const midY = (y0 + y1) / 2
  // 植被固定在 margin 环带内（距最近积木中心 ≥1.4 格位 > 精灵视觉范围 ±1.0）：
  // back 层 = 左/右侧顶点（在积木之前绘制，被建筑自然遮挡、只在侧面探出）；
  // front 层 = 前部顶点与两翼（在积木之后绘制，站在建筑前面完全可见）。
  if (layer === 'back') {
    const vLeft = { x: x0 + 0.1, y: midY }
    const vRight = { x: x1 - 0.1, y: midY }
    if (ecoStage >= 1) {
      put(vLeft.x, vLeft.y, flora)
      put(vRight.x, vRight.y, flora)
    }
    if (ecoStage >= 3) {
      // 阶段 3：两侧灌木长成树（石色树干 + 双层绿冠）
      put(vLeft.x, vLeft.y, flora, 2)
      put(vRight.x, vRight.y, flora, 2)
    }
    return
  }

  // front 层
  const vFront = { x: midX, y: y1 - 0.1 }
  const flankL = { x: x0 + (midX - x0) * 0.72, y: midY + (y1 - midY) * 0.72 }
  const flankR = { x: x1 - (x1 - midX) * 0.72, y: midY + (y1 - midY) * 0.72 }
  if (ecoStage >= 1) {
    put(vFront.x, vFront.y, flora)
  }
  if (ecoStage >= 2) {
    // 阶段 2：两翼各一株灌木 + 一块石
    put(flankL.x, flankL.y, flora)
    put(flankL.x + 0.42, flankL.y + 0.28, stone)
    put(flankR.x, flankR.y, flora)
    put(flankR.x - 0.42, flankR.y + 0.28, stone)
  }
  if (ecoStage >= 3) {
    // 阶段 3：前部灌木长成树（石色树干 + 双层绿冠）
    put(vFront.x, vFront.y, stone)
    put(vFront.x, vFront.y, flora, 2)
  }
  if (ecoStage >= 4) {
    // 阶段 4 积木花园：两翼点缀色花砖 + 树冠
    put(flankL.x, flankL.y, bloom)
    put(flankL.x, flankL.y, flora, 2)
    put(flankR.x, flankR.y, bloom)
    put(flankR.x, flankR.y, flora, 2)
  }
}
