/**
 * 展台沙盘的 canvas 绘制（纯拆分自 ShowcaseScene.tsx）：
 * 底座静态层（含沙盘颜色方案）、地面阴影、拖拽脚印与积木绘制。
 * 每个函数只接收明确的绘制参数，不读取组件状态。
 */
import type { SandboxDesign, ShowcasePlacement } from '../../types'
import type { ModelFootprint } from '../../logic/showcase'
import { mixColor, relativeLuminance } from '../isoColor'
import {
  drawCube,
  drawGroundShadow,
  traceIsoGroundPath,
  withAlpha,
  worldToScreen,
  type IsoConfig,
  type IsoCornerRadii,
  type IsoPalette
} from '../iso'
import type { BaseGeometry, RenderCube } from '../showcaseLayout'
import type { DragState } from './drag'

/** 底座静态层：环境光阴影 + 面向观众的曲面厚度 + 顶面网格（绘制到离屏画布） */
export function renderShowcaseBase(
  bctx: CanvasRenderingContext2D,
  palette: IsoPalette,
  baseGeometry: BaseGeometry,
  cfg: IsoConfig,
  G: number
): void {
  const { topPts, botPts, skirtPts } = baseGeometry
  // 底层环境光柔和阴影
  bctx.save()
  bctx.beginPath()
  botPts.forEach((pt, i) =>
    i === 0 ? bctx.moveTo(pt.sx, pt.sy + 6) : bctx.lineTo(pt.sx, pt.sy + 6)
  )
  bctx.closePath()
  bctx.fillStyle = withAlpha(palette.ink, 0.06)
  bctx.fill()
  bctx.restore()

  // 朝向观众的 3D 侧面厚度（光滑连续曲面，绝无任何外溢线条）：取块体左脸色调做暗面
  if (skirtPts.length > 0) {
    bctx.save()
    bctx.beginPath()
    skirtPts.forEach((pt, i) => (i === 0 ? bctx.moveTo(pt.sx, pt.sy) : bctx.lineTo(pt.sx, pt.sy)))
    bctx.closePath()
    bctx.fillStyle = palette.left
    bctx.fill()
    bctx.strokeStyle = palette.ink
    bctx.lineWidth = 1.5
    bctx.lineJoin = 'round'
    bctx.stroke()
    bctx.restore()
  }

  // 展台顶面（主题块体顶面色 + 墨色外轮廓线）与顶面内部对齐网格
  bctx.save()
  bctx.beginPath()
  topPts.forEach((pt, i) => (i === 0 ? bctx.moveTo(pt.sx, pt.sy) : bctx.lineTo(pt.sx, pt.sy)))
  bctx.closePath()
  bctx.fillStyle = palette.top
  bctx.fill()
  bctx.strokeStyle = palette.ink
  bctx.lineWidth = 1.5
  bctx.lineJoin = 'round'
  bctx.stroke()

  bctx.clip()
  bctx.beginPath()
  for (let i = 1; i < G; i++) {
    const a = worldToScreen(i, 0, 0, cfg)
    const b = worldToScreen(i, G, 0, cfg)
    bctx.moveTo(a.sx, a.sy + cfg.tileH / 2)
    bctx.lineTo(b.sx, b.sy + cfg.tileH / 2)

    const c = worldToScreen(0, i, 0, cfg)
    const d = worldToScreen(G, i, 0, cfg)
    bctx.moveTo(c.sx, c.sy + cfg.tileH / 2)
    bctx.lineTo(d.sx, d.sy + cfg.tileH / 2)
  }
  bctx.strokeStyle = withAlpha(palette.ink, 0.08)
  bctx.lineWidth = 0.8
  bctx.stroke()
  bctx.restore()
}

/** 2.4 每个落位模型的地面接触阴影（积木之前绘制） */
export function drawShowcaseShadows(
  ctx: CanvasRenderingContext2D,
  placements: ShowcasePlacement[],
  offsetBlocksMap: Map<string, Array<{ x: number; y: number }>>,
  cfg: IsoConfig,
  palette: IsoPalette
): void {
  for (const p of placements) {
    const offsetBlocks = offsetBlocksMap.get(p.blueprintId)
    if (!offsetBlocks) continue
    drawGroundShadow(ctx, offsetBlocks, cfg, palette)
  }
}

/** 沙盘设计底色（D-20261128-128）：只从 ART §10 既有材质色取色，不新增色相 */
export const SANDBOX_TINTS: Record<SandboxDesign, string | null> = {
  moss: '#4f776a',
  stone: '#a89f91',
  bloom: '#e9c46a',
  bare: null
}

/** 设计色的混入强度：石白更克制，苔绿/暖沙更明显 */
const DESIGN_TINT_STRENGTH: Record<SandboxDesign, number> = {
  moss: 0.52,
  stone: 0.4,
  bloom: 0.5,
  bare: 0
}

/**
 * 给沙盘底座加上设计色：先把设计色与白色混合成柔化色，再按顶/左/右不同比例混进主题块面，
 * 保持「顶面最亮、左面中、右面最暗」的明暗阶梯；建筑积木本身不染色。
 * 暗色主题降低混入强度，避免沙盘变成一块发亮的彩色板。
 */
export function buildSandboxBasePalette(palette: IsoPalette, design: SandboxDesign): IsoPalette {
  const tint = SANDBOX_TINTS[design]
  const baseStrength = DESIGN_TINT_STRENGTH[design]
  if (!tint || baseStrength <= 0) return palette
  const strength = baseStrength * (relativeLuminance(palette.top) < 0.2 ? 0.7 : 1)
  const soft = mixColor(tint, '#ffffff', 0.2)
  return {
    ...palette,
    top: mixColor(palette.top, soft, strength),
    left: mixColor(palette.left, soft, strength * 0.78),
    right: mixColor(palette.right, soft, strength * 0.62)
  }
}

/** 3. 拖拽时地基磁吸 / 碰撞警告脚印 */
export function drawDragFootprint(
  ctx: CanvasRenderingContext2D,
  currentGx: number,
  currentGy: number,
  fp: ModelFootprint,
  isValid: boolean,
  cfg: IsoConfig
): void {
  const gx0 = currentGx
  const gy0 = currentGy
  const gx1 = gx0 + fp.width
  const gy1 = gy0 + fp.depth

  const dragRadii: IsoCornerRadii = {
    bottom: 0.9,
    side: 0.6,
    top: 0.35
  }

  ctx.save()
  traceIsoGroundPath(ctx, gx0, gx1, gy0, gy1, cfg, dragRadii, cfg.tileH / 2)
  if (isValid) {
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

/** 4. 绘制所有积木（含悬停高亮、拖拽虚影、连击奖励标记） */
export function drawShowcaseCubes(
  ctx: CanvasRenderingContext2D,
  drawList: RenderCube[],
  cfg: IsoConfig,
  palette: IsoPalette,
  hoveredId: string | null,
  drag: DragState | null,
  bonusByBlueprint: Map<string, Array<'streak' | 'attendance' | undefined>>
): void {
  for (const { worldX, worldY, worldZ, block, blueprintId, isDragging, index } of drawList) {
    const { sx: px, sy: py } = worldToScreen(worldX, worldY, worldZ, cfg)
    const isHovered = hoveredId === blueprintId && !drag
    const bonusTier = index !== undefined ? bonusByBlueprint.get(blueprintId)?.[index] : undefined
    const isBonus = bonusTier !== undefined
    drawCube(ctx, px, py + cfg.tileH / 2, cfg, palette, {
      type: block.type,
      color: block.color,
      highlight: isHovered,
      ghost: isDragging && !drag?.isValid,
      bonus: isBonus,
      bonusTier
    })
  }
}
