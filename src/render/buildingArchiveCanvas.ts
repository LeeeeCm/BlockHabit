import type { Blueprint, Language } from '../types'
import type { TranslationSchema } from '../i18n/types'
import type { ArchiveMilestone, BuildingArchive } from '../logic/buildingArchive'
import {
  DEFAULT_ISO_CONFIG,
  drawCube,
  drawGroundBase,
  paletteFromDocument,
  worldToScreen
} from './iso'
import {
  fitModelInto,
  measureModelBounds,
  readYearbookPalette,
  truncateToWidth,
  waitForYearbookFonts,
  wrapTextToWidth,
  type Rect
} from './yearbookCanvas'

/**
 * 建筑档案卡画布（B3 / D-20261110-065）。
 *
 * - 档案卡：逻辑 640×880，DPR 2 导出 1280×1760；纸白/墨色/1px 线/等距积木语言；
 * - 颜色一律从当前主题 CSS 变量读取（四主题共用同一套布局，无新色相；点缀色只用于落成日期小标记）；
 * - 绘制前 await document.fonts.ready（CJK 未就绪会掉字/错字重）；
 * - 等距缩略图复用 A2 画布模块的纯布局函数（measureModelBounds / fitModelInto），不重复实现；
 * - 画布内的中英文书名号差异沿用月度画报的排版例外（仅此处标注）。
 */

export const ARCHIVE_CARD = { width: 640, height: 880, dpr: 2 } as const
/** 弹层里的等距大图预览（CSS 640×260 以内，按 2x 烘焙） */
export const ARCHIVE_STAGE = { width: 640, height: 260, dpr: 2 } as const

const FONT_SANS = '"Rubik", "AlimamaShuHeiTi", "MiSans", sans-serif'
const FONT_NUM = '"Rubik", "MiSans", sans-serif'

type FontWeight = 400 | 500 | 600 | 700

function setFont(
  ctx: CanvasRenderingContext2D,
  weight: FontWeight,
  size: number,
  family = FONT_SANS
): void {
  ctx.font = `${weight} ${size}px ${family}`
}

export function archivePngFileName(blueprintId: string): string {
  return `blockhabit-archive-${blueprintId}.png`
}

/** 关键块标签：首块 / 25% / 50% / 75% / 最后一块 */
export function archiveMilestoneLabel(t: TranslationSchema, milestone: ArchiveMilestone): string {
  if (milestone.kind === 'first') return t.buildingArchive.firstBlock
  if (milestone.kind === 'last') return t.buildingArchive.lastBlock
  return t.buildingArchive.percent(milestone.percent ?? 0)
}

/** 关键块来自哪个习惯（全勤奖励块/已删除习惯有诚实的回退文案） */
export function archiveMilestoneHabitName(
  t: TranslationSchema,
  milestone: ArchiveMilestone
): string {
  if (milestone.habitName) return milestone.habitName
  if (milestone.fromHabitId === '__day__') return t.today.fullCard.bonusHabitName
  if (milestone.checkInId) return t.today.fullCard.deletedHabitName
  return '—'
}

interface IsoStageOptions {
  /** 视口（画布逻辑坐标） */
  rect: Rect
  pad?: number
  maxScale?: number
  baseline?: number
}

/** 画一座建筑的完整等距模型（档案卡与预览共用） */
function drawIsoModel(
  ctx: CanvasRenderingContext2D,
  blueprint: Blueprint,
  bonusByIndex: boolean[],
  options: IsoStageOptions
): void {
  const cfg = DEFAULT_ISO_CONFIG
  const isoPalette = paletteFromDocument()
  const { rect, pad = 16, maxScale = 1.4, baseline = 0.54 } = options

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 10)
  ctx.clip()

  const bounds = measureModelBounds(blueprint.blocks, cfg)
  const fit = fitModelInto(bounds, rect, pad, maxScale, baseline)

  let minBx = Infinity
  let maxBx = -Infinity
  let minBy = Infinity
  let maxBy = -Infinity
  for (const block of blueprint.blocks) {
    minBx = Math.min(minBx, block.x)
    maxBx = Math.max(maxBx, block.x)
    minBy = Math.min(minBy, block.y)
    maxBy = Math.max(maxBy, block.y)
  }
  const centerX = Math.round((minBx + maxBx) / 2)
  const centerY = Math.round((minBy + maxBy) / 2)

  ctx.translate(fit.panX, fit.panY)
  ctx.scale(fit.scale, fit.scale)
  drawGroundBase(ctx, blueprint.blocks, cfg, isoPalette, 0, centerX, centerY)

  const cubes = blueprint.blocks
    .map((block, index) => ({ block, index }))
    .sort((a, b) => {
      const sumA = a.block.x + a.block.y
      const sumB = b.block.x + b.block.y
      if (sumA !== sumB) return sumA - sumB
      return a.block.z - b.block.z
    })
  const indexAt = new Map<string, number>()
  blueprint.blocks.forEach((block, index) => indexAt.set(`${block.x},${block.y},${block.z}`, index))

  for (const { block, index } of cubes) {
    const above = indexAt.get(`${block.x},${block.y},${block.z + 1}`)
    const { sx, sy } = worldToScreen(block.x, block.y, block.z, DEFAULT_ISO_CONFIG)
    drawCube(ctx, sx, sy, DEFAULT_ISO_CONFIG, isoPalette, {
      type: block.type,
      color: block.color,
      noStuds: above !== undefined,
      bonus: bonusByIndex[index] === true,
      // 画布固定 2x 变换，精灵密度对齐，否则图块面模糊（SURFACES.md 既有范式）
      spriteScale: 2
    })
  }
  ctx.restore()
}

/** 弹层预览：一张无文字的等距大图（尺寸 = ARCHIVE_STAGE × DPR） */
export async function drawArchiveStage(
  canvas: HTMLCanvasElement,
  blueprint: Blueprint,
  bonusByIndex: boolean[]
): Promise<void> {
  await waitForYearbookFonts()
  const { width, height, dpr } = ARCHIVE_STAGE
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)

  const palette = readYearbookPalette()
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, width, height)
  drawIsoModel(ctx, blueprint, bonusByIndex, {
    rect: { x: 0, y: 0, w: width, h: height },
    pad: 28,
    maxScale: 1.6,
    baseline: 0.56
  })
}

export interface ArchiveCardInput {
  archive: BuildingArchive
  blueprint: Blueprint
  /** 已本地化的建筑名（画布内不走 i18n 运行时） */
  blueprintName: string
  t: TranslationSchema
  lang: Language
}

function drawMetricCell(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  value: string,
  palette: ReturnType<typeof readYearbookPalette>
): void {
  ctx.fillStyle = palette.surface
  ctx.beginPath()
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8)
  ctx.fill()
  ctx.strokeStyle = palette.line
  ctx.lineWidth = 1
  ctx.stroke()

  setFont(ctx, 500, 9)
  ctx.fillStyle = palette.ink2
  ctx.fillText(truncateToWidth(ctx, label, rect.w - 12), rect.x + 8, rect.y + 17)
  setFont(ctx, 700, 16, FONT_NUM)
  ctx.fillStyle = palette.ink
  ctx.fillText(truncateToWidth(ctx, value, rect.w - 12), rect.x + 8, rect.y + 41)
}

/** 绘制档案卡（物理尺寸 = 逻辑 × DPR） */
export async function drawArchiveCard(
  canvas: HTMLCanvasElement,
  input: ArchiveCardInput
): Promise<void> {
  await waitForYearbookFonts()

  const { width, height, dpr } = ARCHIVE_CARD
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)

  const { archive, blueprint, blueprintName, t, lang } = input
  const palette = readYearbookPalette()
  const a = t.buildingArchive
  const M = 36
  const innerW = width - M * 2

  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, width, height)

  // 1. 封面：标题 / 建筑名 / 落成日 + 第 N 座
  setFont(ctx, 700, 11, FONT_NUM)
  ctx.fillStyle = palette.ink2
  ctx.fillText(a.title.toUpperCase(), M, M + 12)

  setFont(ctx, 700, 30)
  ctx.fillStyle = palette.ink
  // 画布排版例外：zh 用书名号、en 裸名（与月度画报/年鉴保持一致）
  const displayName = lang === 'zh' ? `《${blueprintName}》` : blueprintName
  ctx.fillText(truncateToWidth(ctx, displayName, innerW), M, M + 50)

  setFont(ctx, 500, 13)
  const dateText = archive.completedAt ? a.completedAt(archive.completedAt) : a.empty
  ctx.fillStyle = palette.ink2
  ctx.fillText(truncateToWidth(ctx, dateText, innerW - 140), M, M + 74)
  if (archive.ordinal !== null) {
    ctx.textAlign = 'right'
    setFont(ctx, 600, 12, FONT_NUM)
    ctx.fillStyle = palette.ink2
    ctx.fillText(a.nth(archive.ordinal), M + innerW, M + 74)
    ctx.textAlign = 'left'
  }
  // 落成日期小标记（A1：点缀色只用于完成/落成）
  if (archive.completedAt) {
    ctx.beginPath()
    ctx.arc(M + 3, M + 104, 3, 0, Math.PI * 2)
    ctx.fillStyle = palette.accent
    ctx.fill()
  }
  drawRule(ctx, M, M + innerW, M + 118, palette.line)

  // 2. 等距大图
  const stage: Rect = { x: M, y: 168, w: innerW, h: 246 }
  ctx.fillStyle = palette.surface
  ctx.beginPath()
  ctx.roundRect(stage.x, stage.y, stage.w, stage.h, 14)
  ctx.fill()
  ctx.strokeStyle = palette.line
  ctx.lineWidth = 1
  ctx.stroke()
  drawIsoModel(ctx, blueprint, archive.bonusByIndex, {
    rect: { x: stage.x + 6, y: stage.y + 6, w: stage.w - 12, h: stage.h - 12 },
    pad: 18,
    maxScale: 1.5,
    baseline: 0.54
  })

  // 3. 数据格（5 项）
  const metricsTop = stage.y + stage.h + 18
  const gap = 8
  const cellW = (innerW - gap * 4) / 5
  const cellH = 58
  const daysValue = archive.days === null ? '—' : a.daysValue(archive.days)
  const topHabitValue =
    archive.topHabit === null
      ? '—'
      : a.topHabitValue(archive.topHabit.name || '—', archive.topHabit.count)
  const cells: Array<{ label: string; value: string }> = [
    { label: a.metrics.blocks, value: String(archive.totalBlocks) },
    { label: a.metrics.days, value: daysValue },
    { label: a.metrics.topHabit, value: topHabitValue },
    { label: a.metrics.perfectDays, value: String(archive.dayClaimBlocks) },
    { label: a.metrics.bonusBlocks, value: String(archive.bonusBlocks) }
  ]
  cells.forEach((cell, index) => {
    drawMetricCell(
      ctx,
      { x: M + index * (cellW + gap), y: metricsTop, w: cellW, h: cellH },
      cell.label,
      cell.value,
      palette
    )
  })

  // 4. 时间线（首块 / 25% / 50% / 75% / 末块）
  const timelineTop = metricsTop + cellH + 26
  setFont(ctx, 700, 12)
  ctx.fillStyle = palette.ink
  ctx.fillText(a.timeline, M, timelineTop)
  drawRule(ctx, M, M + innerW, timelineTop + 8, palette.line)

  const rowH = 38
  archive.milestones.forEach((milestone, index) => {
    const rowY = timelineTop + 30 + index * rowH
    // 节点圆点 + 竖向导轨
    ctx.beginPath()
    ctx.arc(M + 4, rowY - 4, 3, 0, Math.PI * 2)
    ctx.fillStyle = palette.ink
    ctx.fill()
    if (index < archive.milestones.length - 1) {
      ctx.strokeStyle = palette.line
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(M + 4, rowY - 1)
      ctx.lineTo(M + 4, rowY + rowH - 7)
      ctx.stroke()
    }

    setFont(ctx, 600, 11)
    ctx.fillStyle = palette.ink
    ctx.fillText(truncateToWidth(ctx, archiveMilestoneLabel(t, milestone), 88), M + 18, rowY)
    setFont(ctx, 500, 11, FONT_NUM)
    ctx.fillStyle = palette.ink2
    ctx.fillText(milestone.date || '—', M + 112, rowY)
    setFont(ctx, 400, 11)
    ctx.fillStyle = palette.ink2
    ctx.fillText(
      truncateToWidth(ctx, archiveMilestoneHabitName(t, milestone), innerW - 210),
      M + 208,
      rowY
    )
  })

  // 5. 奠基石铭言（有才画，不伪造）
  if (archive.foundationNote) {
    const noteTop = timelineTop + 30 + archive.milestones.length * rowH + 14
    setFont(ctx, 700, 11)
    ctx.fillStyle = palette.ink
    ctx.fillText(a.noteLabel, M, noteTop)
    setFont(ctx, 400, 12)
    ctx.fillStyle = palette.ink2
    const lines = wrapTextToWidth(ctx, `“${archive.foundationNote}”`, innerW, 2)
    lines.forEach((line, index) => ctx.fillText(line, M, noteTop + 20 + index * 18))
  }

  // 6. 页脚
  const footerY = height - 40
  drawRule(ctx, M, M + innerW, footerY, palette.line)
  setFont(ctx, 600, 10, FONT_NUM)
  ctx.fillStyle = palette.ink2
  ctx.fillText(`BLOCKHABIT · ${a.title}`, M, footerY + 20)
  if (archive.completedAt) {
    ctx.textAlign = 'right'
    ctx.fillText(archive.completedAt, M + innerW, footerY + 20)
    ctx.textAlign = 'left'
  }
}

function drawRule(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  color: string
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
}

/** 离屏渲染档案卡（保存 PNG / 未来档案包复用） */
export async function renderArchiveCardCanvas(input: ArchiveCardInput): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  // 自动化断言用标记（无视觉变化）：确认档案卡画布确实生成/尺寸正确。
  canvas.dataset.testid = 'archive-card-canvas'
  await drawArchiveCard(canvas, input)
  return canvas
}

/** 保存档案卡 PNG；返回是否成功 */
export async function saveArchivePng(
  canvas: HTMLCanvasElement,
  blueprintId: string
): Promise<boolean> {
  if (typeof canvas.toBlob !== 'function') return false
  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((value) => resolve(value), 'image/png')
    } catch {
      resolve(null)
    }
  })
  if (!blob) return false
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = archivePngFileName(blueprintId)
    link.click()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return true
}
