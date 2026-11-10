import type { BlockDef } from '../types'
import {
  DEFAULT_ISO_CONFIG,
  STUD_H,
  drawCube,
  drawGroundBase,
  worldToScreen,
  type IsoConfig,
  type IsoPalette,
} from './iso'

/**
 * 等距模型公共舞台（B2 / D-20261110-060 技术校订 §2）。
 *
 * 画报（MonthlyPosterModal）/ 相纸（PolaroidModal）/ 图鉴缩略图（BlueprintThumb）/
 * 年鉴缩略图（yearbookCanvas）此前各自实现 measure → fit → painter 三段逻辑，
 * 这里收敛成一套纯函数，保证四处的投影、画家排序、地基与凸点省略规则完全一致。
 *
 * 边界：本模块只决定「等距模型怎么摆、按什么顺序画」；
 * 主题色读取（CSS 变量 / 剪影派生）、圆角裁剪、文字排版仍由各消费者自己负责——
 * 画报/相纸的舞台圆角与年鉴缩略图不同，图鉴还有「剪影不泄露配色」的语义。
 *
 * 像素级约束：所有数值运算保持与抽取前逐字一致（同样的 min/max 顺序、同样的
 * Math.min 参数顺序、同样的舍入），重构前后同一输入必须输出逐像素相同的 PNG。
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface ModelBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface ModelFit {
  scale: number
  panX: number
  panY: number
}

/** 水平/垂直可分别指定内边距（画报舞台是 30/25，相纸是 30/30） */
export interface ModelPadding {
  x: number
  y: number
}

/** 等距模型在屏幕空间的包围盒（含凸点顶部与块体底部） */
export function measureModelBounds(
  blocks: BlockDef[],
  cfg: IsoConfig = DEFAULT_ISO_CONFIG,
): ModelBounds {
  if (blocks.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const block of blocks) {
    const { sx, sy } = worldToScreen(block.x, block.y, block.z, cfg)
    minX = Math.min(minX, sx - cfg.tileW / 2)
    maxX = Math.max(maxX, sx + cfg.tileW / 2)
    minY = Math.min(minY, sy - cfg.tileH / 2 - STUD_H)
    maxY = Math.max(maxY, sy + cfg.tileH / 2 + cfg.blockH)
  }
  return { minX, maxX, minY, maxY }
}

/**
 * 把模型包围盒等比塞进视口。
 *
 * @param pad      内边距：数字 = 四边等距；{x,y} = 水平/垂直分开（画报 30/25）
 * @param maxScale 缩放上限（画报/相纸 1.5，图鉴 0.9，年鉴缩略图 0.7）
 * @param baseline 垂直基准线（0.5 = 居中；画报/相纸 0.54 让模型略低于舞台中线）
 */
export function fitModelInto(
  bounds: ModelBounds,
  viewport: Rect,
  pad: number | ModelPadding = 6,
  maxScale = 1,
  baseline = 0.5,
): ModelFit {
  const padX = typeof pad === 'number' ? pad : pad.x
  const padY = typeof pad === 'number' ? pad : pad.y
  const spanX = Math.max(1, bounds.maxX - bounds.minX)
  const spanY = Math.max(1, bounds.maxY - bounds.minY)
  const availableW = Math.max(1, viewport.w - padX * 2)
  const availableH = Math.max(1, viewport.h - padY * 2)
  const scale = Math.min(availableW / spanX, availableH / spanY, maxScale)
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  return {
    scale,
    panX: viewport.x + viewport.w / 2 - centerX * scale,
    panY: viewport.y + viewport.h * baseline - centerY * scale,
  }
}

/**
 * 地基中心（按块 x/y 范围的整数中点）。
 * 画报只落了一部分时，地基仍按完整蓝图铺（与抽取前一致）。
 */
export function modelGroundCenter(blocks: BlockDef[]): { cx: number; cy: number } {
  if (blocks.length === 0) return { cx: 0, cy: 0 }
  let minBx = Infinity
  let maxBx = -Infinity
  let minBy = Infinity
  let maxBy = -Infinity
  for (const block of blocks) {
    minBx = Math.min(minBx, block.x)
    maxBx = Math.max(maxBx, block.x)
    minBy = Math.min(minBy, block.y)
    maxBy = Math.max(maxBy, block.y)
  }
  return { cx: Math.round((minBx + maxBx) / 2), cy: Math.round((minBy + maxBy) / 2) }
}

export interface PaintModelOptions {
  /** 实际要绘制的积木（画报未完成时 = 已落块；其余 = 完整蓝图） */
  blocks: BlockDef[]
  palette: IsoPalette
  cfg?: IsoConfig
  /** 画地基用的块集合；缺省 = blocks（画报传完整蓝图，未完成时地基不缩水） */
  groundBlocks?: BlockDef[]
  /** 计算 fit 包围盒用的块集合；缺省 = groundBlocks ?? blocks */
  boundsBlocks?: BlockDef[]
  /** 每块 bonus 标记（按 blocks 序位；缺省全部 false） */
  bonusByIndex?: boolean[]
  /** 精灵位图密度覆盖：导出画布固定 2x 传 2；小缩略图传 1 避免重烘焙 */
  spriteScale?: number
  /** 跳过地基（图鉴剪影态不画「正在建造」的虚线地基） */
  skipGround?: boolean
  /** 忽略建筑专属配色（图鉴剪影态，防止彩色块泄露） */
  ignoreBlockColor?: boolean
}

/**
 * 在「当前变换」下绘制等距模型：地基 → 画家排序 → 积木。
 * 调用方负责 save/clip/translate/scale 与 restore；本函数不再嵌套变换。
 */
export function paintModel(ctx: CanvasRenderingContext2D, options: PaintModelOptions): void {
  const cfg = options.cfg ?? DEFAULT_ISO_CONFIG
  const { palette } = options
  const blocks = options.blocks

  if (!options.skipGround) {
    const groundBlocks = options.groundBlocks ?? blocks
    if (groundBlocks.length > 0) {
      const { cx, cy } = modelGroundCenter(groundBlocks)
      drawGroundBase(ctx, groundBlocks, cfg, palette, 0, cx, cy)
    }
  }

  if (blocks.length === 0) return

  // 画家算法：按 x+y（深度）再按 z 排序，被上层块遮挡的面自动覆盖
  const cubes = blocks
    .map((block, index) => ({ block, index }))
    .sort((a, b) => {
      const sumA = a.block.x + a.block.y
      const sumB = b.block.x + b.block.y
      if (sumA !== sumB) return sumA - sumB
      return a.block.z - b.block.z
    })
  const indexAt = new Map<string, number>()
  blocks.forEach((block, index) => indexAt.set(`${block.x},${block.y},${block.z}`, index))

  for (const { block, index } of cubes) {
    const above = indexAt.get(`${block.x},${block.y},${block.z + 1}`)
    const { sx, sy } = worldToScreen(block.x, block.y, block.z, cfg)
    drawCube(ctx, sx, sy, cfg, palette, {
      type: block.type,
      color: options.ignoreBlockColor ? undefined : block.color,
      noStuds: above !== undefined,
      bonus: options.bonusByIndex ? options.bonusByIndex[index] === true : false,
      spriteScale: options.spriteScale,
    })
  }
}

export interface PaintModelStageOptions extends PaintModelOptions {
  /** 视口（画布坐标系；x/y 即 offset） */
  viewport: Rect
  pad?: number | ModelPadding
  maxScale?: number
  baseline?: number
  /** 直接给定包围盒（缺省按 boundsBlocks 现算） */
  bounds?: ModelBounds
}

/**
 * fit + painter 一步到位：measure → fit → translate/scale → paintModel。
 * 返回实际使用的 fit，便于调用方断言/调试。
 */
export function paintModelStage(
  ctx: CanvasRenderingContext2D,
  options: PaintModelStageOptions,
): ModelFit {
  const boundsBlocks = options.boundsBlocks ?? options.groundBlocks ?? options.blocks
  const bounds = options.bounds ?? measureModelBounds(boundsBlocks, options.cfg)
  const fit = fitModelInto(
    bounds,
    options.viewport,
    options.pad ?? 6,
    options.maxScale ?? 1,
    options.baseline ?? 0.5,
  )
  ctx.save()
  ctx.translate(fit.panX, fit.panY)
  ctx.scale(fit.scale, fit.scale)
  paintModel(ctx, options)
  ctx.restore()
  return fit
}

export interface ModelCanvasOptions {
  /** 逻辑宽度（CSS 像素） */
  width: number
  /** 逻辑高度（CSS 像素） */
  height: number
  /** 位图密度；缺省 = min(devicePixelRatio, 2)，与图鉴缩略图既有行为一致 */
  dpr?: number
  /** 是否先 clearRect（缩略图需要透明底；导出画布通常自己铺底纸） */
  clear?: boolean
}

/**
 * 准备一个按 dpr 放大的离屏/在屏 canvas，并返回已 setTransform 的 2D context。
 * 只做尺寸与变换，不绘制任何东西。
 */
export function prepareModelCanvas(
  canvas: HTMLCanvasElement,
  options: ModelCanvasOptions,
): CanvasRenderingContext2D | null {
  const ratio =
    options.dpr ??
    Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
  canvas.width = options.width * ratio
  canvas.height = options.height * ratio
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  if (options.clear !== false) ctx.clearRect(0, 0, options.width, options.height)
  return ctx
}
