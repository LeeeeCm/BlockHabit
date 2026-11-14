/**
 * 展台沙盘的 canvas 绘制（纯拆分自 ShowcaseScene.tsx）：
 * 底座静态层、地面阴影、微生态植被、拖拽脚印与积木绘制。
 * 每个函数只接收明确的绘制参数，不读取组件状态。
 */
import type { ShowcasePlacement } from '../../types'
import type { ModelFootprint } from '../../logic/showcase'
import {
  drawCube,
  drawEcoProps,
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

/** 2.4 每个落位模型的地面接触阴影（积木与植被之前绘制） */
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

/** 2.5 微生态植被：每个落位模型的 margin 环带内（积木之前绘制，正确深度） */
export function drawShowcaseEco(
  ctx: CanvasRenderingContext2D,
  placements: ShowcasePlacement[],
  offsetBlocksMap: Map<string, Array<{ x: number; y: number }>>,
  cfg: IsoConfig,
  palette: IsoPalette,
  stage: number,
  seed: number
): void {
  if (stage < 1) return
  for (const p of placements) {
    const offsetBlocks = offsetBlocksMap.get(p.blueprintId)
    if (!offsetBlocks) continue
    drawEcoProps(ctx, offsetBlocks, cfg, palette, 0, 0, 0, stage, 'back', seed)
    drawEcoProps(ctx, offsetBlocks, cfg, palette, 0, 0, 0, stage, 'front', seed)
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

/** 4. 绘制所有积木（含悬停/选中高亮、拖拽虚影、连击奖励标记） */
export function drawShowcaseCubes(
  ctx: CanvasRenderingContext2D,
  drawList: RenderCube[],
  cfg: IsoConfig,
  palette: IsoPalette,
  hoveredId: string | null,
  selectedId: string | null,
  drag: DragState | null,
  bonusByBlueprint: Map<string, Array<'streak' | 'attendance' | undefined>>
): void {
  for (const { worldX, worldY, worldZ, block, blueprintId, isDragging, index } of drawList) {
    const { sx: px, sy: py } = worldToScreen(worldX, worldY, worldZ, cfg)
    const isHovered = (hoveredId === blueprintId || selectedId === blueprintId) && !drag
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
