import type { BlockDef, Blueprint, Language } from '../types'
import type { TranslationSchema } from '../i18n/types'
import type { BuildingEntry, YearbookModel } from '../logic/yearbook'
import { formatPeakHour } from '../logic/yearbook'
import { blueprints } from '../logic/blueprints'
import {
  DEFAULT_ISO_CONFIG,
  STUD_H,
  drawCube,
  drawGroundBase,
  paletteFromDocument,
  withAlpha,
  worldToScreen,
  type IsoConfig,
  type IsoPalette,
} from './iso'

/**
 * 落成年鉴画布（D-20261110-060）。
 *
 * - 竖版单页 720 × 1200 逻辑像素，按 DPR 2 导出 1440 × 2400；
 * - 纸白 / 墨色 / 1px 线 / 等距积木语言：颜色一律从当前主题 CSS 变量读取（四主题共用同一套布局）；
 * - 绘制与导出前先 await document.fonts.ready（CJK 未就绪会掉字/错字重）；
 * - 只做「封面 + 本年总结」一页，不做超长 12 屏拼接（内存与阅读体验都差）；
 * - 单页建筑年表两列最多展示 12 座（每列 6），超出以「+N」计数，不伪造条目。
 *
 * 本模块不修改任何既有渲染实现（画报/相纸/图鉴的 modelStage 抽取不在本次写入范围内），
 * 缩略图复用 iso 的 fit + painter 排序 + drawCube；年鉴缩略图视口很小，垂直基准取居中（0.5），
 * 而不是画报大舞台的 0.54 地面基准（后者在小视口里会把模型顶出边界）。
 */

export const YEARBOOK_CANVAS = { width: 720, height: 1200, dpr: 2 } as const
/** 单列最多展示数；两列时单页最多 12 座（其余折叠为 +N，不伪造条目） */
export const YEARBOOK_MAX_BUILDINGS = 6
/** 单页总上限（两列 × 6） */
export const YEARBOOK_MAX_BUILDINGS_TOTAL = YEARBOOK_MAX_BUILDINGS * 2

const FONT_SANS = '"Rubik", "AlimamaShuHeiTi", "MiSans", sans-serif'
const FONT_NUM = '"Rubik", "MiSans", sans-serif'

/** 年鉴用主题色快照（只含纸/墨/线/点缀，不引入新色相） */
export interface YearbookPalette {
  bg: string
  surface: string
  ink: string
  ink2: string
  line: string
  accent: string
}

/** 从 document 的 CSS 变量读取当前主题；缺变量时回退到纸白主题令牌值（与画报一致的做法） */
export function readYearbookPalette(doc: Document = document): YearbookPalette {
  const style = doc?.defaultView?.getComputedStyle?.(doc.documentElement)
  const read = (name: string, fallback: string): string => {
    const value = style?.getPropertyValue(name).trim()
    return value ? value : fallback
  }
  return {
    bg: read('--bg', '#fafafa'),
    surface: read('--surface', '#ffffff'),
    ink: read('--ink', '#0a0a0a'),
    ink2: read('--ink-2', '#6b6b6b'),
    line: read('--line', '#e8e8e8'),
    accent: read('--accent', '#f5b301'),
  }
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface YearbookLayout {
  width: number
  height: number
  margin: number
  innerWidth: number
  /** 封面标题区 */
  header: Rect
  /** 「这一年」统计区 */
  overview: Rect
  /** 「十二个月」热图区 */
  months: Rect
  /** 「建筑年表」区 */
  buildings: Rect
  /** 「时间形状」区 */
  shape: Rect
  /** 「当年一句」区 */
  quote: Rect
  /** 页脚（来源/署名） */
  footer: Rect
}

export interface YearbookLayoutOptions {
  /** 建筑年表实际展示行数（0 行时按 1 行留空态高度） */
  buildingRows?: number
  /** 建筑超过单页上限时是否留一行「+N」溢出位 */
  overflow?: boolean
}

/**
 * 纯布局：单页竖版分栏。所有区块自上而下排列、互不重叠。
 * 封面/统计/月份固定；建筑年表按实际行数收缩，腾出的纵向空间留给「当年一句」，
 * 让建筑较少的年份页仍有呼吸感（不拉伸行高、不伪造条目）；页脚固定贴底。
 */
export function computeYearbookLayout(
  width: number = YEARBOOK_CANVAS.width,
  height: number = YEARBOOK_CANVAS.height,
  options: YearbookLayoutOptions = {},
): YearbookLayout {
  const margin = Math.round(width * 0.078)
  const innerWidth = width - margin * 2
  const y = (ratio: number): number => Math.round(height * ratio)
  const h = (ratio: number): number => Math.round(height * ratio)

  const rows = Math.max(
    1,
    Math.min(
      YEARBOOK_MAX_BUILDINGS,
      Math.floor(options.buildingRows ?? YEARBOOK_MAX_BUILDINGS),
    ),
  )
  const buildingRowHeight = 52
  const buildingsTop = y(0.5167)
  const buildingsHeight = 18 + rows * buildingRowHeight + (options.overflow ? 24 : 0)
  const shapeTop = buildingsTop + buildingsHeight + 22
  const shapeHeight = 78
  const footerTop = height - Math.round(height * 0.0433)
  const footerHeight = 28
  const quoteTop = shapeTop + shapeHeight + 2
  const quoteHeight = Math.max(84, footerTop - 12 - quoteTop)

  return {
    width,
    height,
    margin,
    innerWidth,
    header: { x: margin, y: y(0.0333), w: innerWidth, h: h(0.113) },
    overview: { x: margin, y: y(0.17), w: innerWidth, h: h(0.118) },
    months: { x: margin, y: y(0.31), w: innerWidth, h: h(0.185) },
    buildings: { x: margin, y: buildingsTop, w: innerWidth, h: buildingsHeight },
    shape: { x: margin, y: shapeTop, w: innerWidth, h: shapeHeight },
    quote: { x: margin, y: quoteTop, w: innerWidth, h: quoteHeight },
    footer: { x: margin, y: footerTop, w: innerWidth, h: footerHeight },
  }
}

/** 统计格（7 项 → 4 列 × 2 行） */
export function metricCellRects(
  area: Rect,
  count = 7,
  cols = 4,
  rowHeight = 56,
  gap = 10,
  cellHeight = 46,
): Rect[] {
  const cellWidth = (area.w - gap * (cols - 1)) / cols
  return Array.from({ length: count }, (_, index) => ({
    x: area.x + (index % cols) * (cellWidth + gap),
    y: area.y + Math.floor(index / cols) * rowHeight,
    w: cellWidth,
    h: cellHeight,
  }))
}

export interface MonthRowLayout {
  label: Rect
  cells: Rect[]
}

/** 12 个月 × 最多 31 天的灰阶热图行布局 */
export function monthGridRects(
  area: Rect,
  rowHeight = 17,
  labelWidth = 40,
  cell = 13,
  gap = 2,
): MonthRowLayout[] {
  const pitch = cell + gap
  return Array.from({ length: 12 }, (_, index) => {
    const rowY = area.y + 18 + index * rowHeight
    return {
      label: { x: area.x, y: rowY, w: labelWidth, h: cell },
      cells: Array.from({ length: 31 }, (_, day) => ({
        x: area.x + labelWidth + day * pitch,
        y: rowY,
        w: cell,
        h: cell,
      })),
    }
  })
}

export interface BuildingRowLayout {
  row: Rect
  thumb: Rect
  textX: number
  textWidth: number
}

/** 建筑年表网格布局（cols=2 时按列优先排；缩略图 + 名称/日期/铭言） */
export function buildingGridRects(area: Rect, rows: number, cols = 1): BuildingRowLayout[] {
  const rowHeight = 52
  const thumbSize = 40
  const gap = 18
  const colWidth = (area.w - gap * (cols - 1)) / cols
  const cells: BuildingRowLayout[] = []
  for (let col = 0; col < cols; col++) {
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const x = area.x + col * (colWidth + gap)
      const row: Rect = { x, y: area.y + 18 + rowIndex * rowHeight, w: colWidth, h: rowHeight }
      cells.push({
        row,
        thumb: { x, y: row.y + 2, w: thumbSize, h: thumbSize },
        textX: x + thumbSize + 14,
        textWidth: colWidth - thumbSize - 14,
      })
    }
  }
  return cells
}

/** 单列行布局（向后兼容；两列用 buildingGridRects） */
export function buildingRowRects(area: Rect, count: number): BuildingRowLayout[] {
  return buildingGridRects(area, count, 1)
}

export interface ModelBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/** 等距模型在屏幕空间的包围盒（含凸点顶部与块底，与画报/相纸一致） */
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

export interface ModelFit {
  scale: number
  panX: number
  panY: number
}

/** 把模型包围盒等比塞进视口（pad 内边距、maxScale 上限、baseline 垂直基准线） */
export function fitModelInto(
  bounds: ModelBounds,
  viewport: Rect,
  pad = 6,
  maxScale = 1,
  baseline = 0.5,
): ModelFit {
  const spanX = Math.max(1, bounds.maxX - bounds.minX)
  const spanY = Math.max(1, bounds.maxY - bounds.minY)
  const availableW = Math.max(1, viewport.w - pad * 2)
  const availableH = Math.max(1, viewport.h - pad * 2)
  const scale = Math.min(availableW / spanX, availableH / spanY, maxScale)
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  return {
    scale,
    panX: viewport.x + viewport.w / 2 - centerX * scale,
    panY: viewport.y + viewport.h * baseline - centerY * scale,
  }
}

/** 单行文本按宽度截断（超出补 ...） */
export function truncateToWidth(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  text: string,
  maxWidth: number,
): string {
  if (maxWidth <= 0) return ''
  if (ctx.measureText(text).width <= maxWidth) return text
  let out = text
  while (out.length > 1 && ctx.measureText(out + '...').width > maxWidth) out = out.slice(0, -1)
  return out.length < text.length ? out + '...' : out
}

/** 多行文本折行（按字符宽度折，末行超宽截断） */
export function wrapTextToWidth(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  text: string,
  maxWidth: number,
  maxLines = 2,
): string[] {
  const lines: string[] = []
  let rest = text
  while (rest.length > 0 && lines.length < maxLines) {
    if (ctx.measureText(rest).width <= maxWidth) {
      lines.push(rest)
      rest = ''
      break
    }
    let cut = rest.length
    while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxWidth) cut--
    const space = rest.lastIndexOf(' ', cut)
    if (space > 0 && space > cut * 0.6) cut = space
    if (lines.length === maxLines - 1) {
      lines.push(truncateToWidth(ctx, rest, maxWidth))
      rest = ''
      break
    }
    lines.push(rest.slice(0, cut).trimEnd())
    rest = rest.slice(cut).trimStart()
  }
  return lines
}

/* ---------------- 绘制原语 ---------------- */

type FontWeight = 400 | 500 | 600 | 700

function setFont(
  ctx: CanvasRenderingContext2D,
  weight: FontWeight,
  size: number,
  family = FONT_SANS,
): void {
  ctx.font = `${weight} ${size}px ${family}`
}

function drawRule(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  color: string,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
}

function sectionTitle(
  ctx: CanvasRenderingContext2D,
  area: Rect,
  text: string,
  palette: YearbookPalette,
): void {
  setFont(ctx, 600, 12)
  ctx.fillStyle = palette.ink2
  ctx.fillText(text, area.x, area.y + 11)
  drawRule(ctx, area.x, area.x + area.w, area.y + 16, palette.line)
}

function habitLabel(t: TranslationSchema, name: string): string {
  return name || t.today.fullCard.deletedHabitName
}

function blueprintLabel(t: TranslationSchema, blueprintId: string): string {
  return t.blueprints[blueprintId] || blueprintId
}

/** 等距建筑缩略图：fit → 地基 → 画家排序 → 积木 */
function drawBuildingThumb(
  ctx: CanvasRenderingContext2D,
  blueprint: Blueprint,
  rect: Rect,
  palette: IsoPalette,
  cfg: IsoConfig,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 4)
  ctx.clip()

  const bounds = measureModelBounds(blueprint.blocks, cfg)
  const fit = fitModelInto(bounds, rect, 3, 0.7)

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
  drawGroundBase(ctx, blueprint.blocks, cfg, palette, 0, centerX, centerY)

  const cubes = blueprint.blocks
    .map((block, index) => ({ block, index }))
    .sort((a, b) => {
      const sumA = a.block.x + a.block.y
      const sumB = b.block.x + b.block.y
      if (sumA !== sumB) return sumA - sumB
      return a.block.z - b.block.z
    })
  const indexAt = new Map<string, number>()
  blueprint.blocks.forEach((block, index) =>
    indexAt.set(`${block.x},${block.y},${block.z}`, index),
  )

  for (const { block } of cubes) {
    const above = indexAt.get(`${block.x},${block.y},${block.z + 1}`)
    const { sx, sy } = worldToScreen(block.x, block.y, block.z, cfg)
    drawCube(ctx, sx, sy, cfg, palette, {
      type: block.type,
      color: block.color,
      noStuds: above !== undefined,
      bonus: false,
      // 缩略图很小：精灵固定 1x 烘焙，避免每个小图都在 2x 下重烘焙撑大缓存
      spriteScale: 1,
    })
  }
  ctx.restore()
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  layout: YearbookLayout,
  model: YearbookModel,
  palette: YearbookPalette,
  t: TranslationSchema,
): void {
  const area = layout.header
  setFont(ctx, 700, 12, FONT_NUM)
  ctx.fillStyle = palette.ink2
  ctx.fillText(t.yearbook.coverTitle, area.x, area.y + 14)

  setFont(ctx, 700, 72, FONT_NUM)
  ctx.fillStyle = palette.ink
  ctx.fillText(String(model.year), area.x, area.y + 92)

  setFont(ctx, 500, 13)
  ctx.fillStyle = palette.ink2
  const line = `${t.yearbook.metrics.checkIns} ${model.stats.checkIns} · ${t.yearbook.metrics.blocks} ${model.stats.blocks} · ${t.yearbook.metrics.buildings} ${model.stats.completedBuildings}`
  ctx.fillText(truncateToWidth(ctx, line, area.w), area.x, area.y + 120)

  drawRule(ctx, area.x, area.x + area.w, area.y + area.h - 1, palette.line)
}

function drawOverview(
  ctx: CanvasRenderingContext2D,
  layout: YearbookLayout,
  model: YearbookModel,
  palette: YearbookPalette,
  t: TranslationSchema,
): void {
  const area = layout.overview
  sectionTitle(ctx, area, t.yearbook.sections.overview, palette)

  const hours = Math.round(model.stats.focusMinutes / 6) / 10
  const metrics: Array<{ label: string; value: string }> = [
    { label: t.yearbook.metrics.checkIns, value: String(model.stats.checkIns) },
    { label: t.yearbook.metrics.blocks, value: String(model.stats.blocks) },
    { label: t.yearbook.metrics.buildings, value: String(model.stats.completedBuildings) },
    { label: t.yearbook.metrics.allClear, value: String(model.stats.perfectDays) },
    { label: t.yearbook.metrics.longestStreak, value: t.yearbook.streakDays(model.stats.longestStreak) },
    { label: t.yearbook.metrics.focusHours, value: t.yearbook.focusHoursValue(hours) },
    { label: t.yearbook.metrics.notes, value: String(model.stats.notes) },
  ]
  const cells = metricCellRects({ ...area, y: area.y + 26 })
  cells.forEach((cell, index) => {
    const metric = metrics[index]
    if (!metric) return
    setFont(ctx, 700, 24, FONT_NUM)
    ctx.fillStyle = palette.ink
    ctx.fillText(truncateToWidth(ctx, metric.value, cell.w), cell.x, cell.y + 26)
    setFont(ctx, 500, 11)
    ctx.fillStyle = palette.ink2
    ctx.fillText(truncateToWidth(ctx, metric.label, cell.w), cell.x, cell.y + 42)
  })
}

function drawMonthsLegend(
  ctx: CanvasRenderingContext2D,
  right: number,
  baseline: number,
  palette: YearbookPalette,
  t: TranslationSchema,
): void {
  setFont(ctx, 500, 10)
  const low = t.yearbook.monthsLegendLow
  const high = t.yearbook.monthsLegendHigh
  const lowWidth = ctx.measureText(low).width
  const highWidth = ctx.measureText(high).width
  const square = 9
  const gap = 4
  const ramp = 5
  const pitch = square + 2
  const total = lowWidth + gap + square + gap + ramp * pitch - 2 + gap + highWidth
  let x = right - total
  ctx.fillStyle = palette.ink2
  ctx.fillText(low, x, baseline)
  x += lowWidth + gap
  for (let step = 0; step < ramp; step++) {
    ctx.fillStyle = withAlpha(palette.ink, 0.08 + (step / (ramp - 1)) * 0.55)
    ctx.beginPath()
    ctx.roundRect(x + step * pitch, baseline - square, square, square, 2)
    ctx.fill()
  }
  x += ramp * pitch - 2 + gap
  ctx.fillStyle = palette.ink2
  ctx.fillText(high, x, baseline)
}

function drawMonths(
  ctx: CanvasRenderingContext2D,
  layout: YearbookLayout,
  model: YearbookModel,
  palette: YearbookPalette,
  t: TranslationSchema,
): void {
  const area = layout.months
  sectionTitle(ctx, area, t.yearbook.sections.months, palette)
  drawMonthsLegend(ctx, area.x + area.w, area.y + 11, palette, t)

  const rows = monthGridRects(area)
  rows.forEach((row, index) => {
    const month = model.months[index]
    if (!month) return
    setFont(ctx, 600, 10, FONT_NUM)
    ctx.fillStyle = palette.ink2
    ctx.fillText(String(month.month).padStart(2, '0'), row.label.x, row.label.y + 10)

    month.days.forEach((day, dayIndex) => {
      const cell = row.cells[dayIndex]
      if (!cell) return
      ctx.beginPath()
      ctx.roundRect(cell.x, cell.y, cell.w, cell.h, 3)
      if (day.future) {
        ctx.strokeStyle = withAlpha(palette.ink, 0.18)
        ctx.lineWidth = 1
        ctx.stroke()
        return
      }
      // 无在册习惯的日子（ratio < 0）留白：不伪造「0% 完成」的灰度
      if (day.ratio < 0) return
      ctx.fillStyle = withAlpha(palette.ink, 0.05 + day.ratio * 0.6)
      ctx.fill()
      if (day.claimed) {
        // 全勤日：点缀色 1px 描边（A1 ③ 全勤奖励语义，不新增色相）
        ctx.strokeStyle = palette.accent
        ctx.lineWidth = 1.2
        ctx.stroke()
      }
    })
  })
}

function drawBuildings(
  ctx: CanvasRenderingContext2D,
  layout: YearbookLayout,
  model: YearbookModel,
  palette: YearbookPalette,
  isoPalette: IsoPalette,
  t: TranslationSchema,
  lang: Language,
): void {
  const area = layout.buildings
  sectionTitle(ctx, area, t.yearbook.sections.buildings, palette)

  if (model.buildings.length === 0) {
    setFont(ctx, 500, 12)
    ctx.fillStyle = palette.ink2
    ctx.fillText(t.yearbook.noData, area.x, area.y + 42)
    return
  }

  const overflow = Math.max(0, model.buildings.length - YEARBOOK_MAX_BUILDINGS_TOTAL)
  const visible: BuildingEntry[] = model.buildings.slice(0, YEARBOOK_MAX_BUILDINGS_TOTAL)
  const columns = visible.length > YEARBOOK_MAX_BUILDINGS ? 2 : 1
  const rowsPerColumn = Math.max(1, Math.ceil(visible.length / columns))
  const rows = buildingGridRects(area, rowsPerColumn, columns)
  const cfg = DEFAULT_ISO_CONFIG

  rows.forEach((rowLayout, index) => {
    const entry = visible[index]
    if (!entry) return
    const { row, thumb, textX, textWidth } = rowLayout

    ctx.fillStyle = palette.surface
    ctx.beginPath()
    ctx.roundRect(thumb.x, thumb.y, thumb.w, thumb.h, 4)
    ctx.fill()
    ctx.strokeStyle = palette.line
    ctx.lineWidth = 1
    ctx.stroke()

    const blueprint = blueprints[entry.blueprintId]
    if (blueprint) drawBuildingThumb(ctx, blueprint, thumb, isoPalette, cfg)

    const name = blueprintLabel(t, entry.blueprintId)
    setFont(ctx, 600, 13)
    ctx.fillStyle = palette.ink
    // 画布排版例外：zh 用书名号、en 用裸名（与月度画报一致）
    const title = lang === 'zh' ? `《${name}》` : name
    ctx.fillText(truncateToWidth(ctx, title, textWidth), textX, row.y + 16)

    setFont(ctx, 500, 11)
    ctx.fillStyle = palette.ink2
    ctx.fillText(
      truncateToWidth(ctx, t.yearbook.buildingDate(entry.completedAt ?? ''), textWidth),
      textX,
      row.y + 32,
    )

    if (entry.foundationNote) {
      setFont(ctx, 400, 11)
      ctx.fillStyle = palette.ink2
      const note = `“${entry.foundationNote}”`
      ctx.fillText(truncateToWidth(ctx, note, textWidth), textX, row.y + 47)
    }
  })

  if (overflow > 0) {
    setFont(ctx, 600, 12, FONT_NUM)
    ctx.fillStyle = palette.ink2
    ctx.fillText(`+${overflow}`, area.x, area.y + 18 + rowsPerColumn * 52 + 14)
  }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  layout: YearbookLayout,
  model: YearbookModel,
  palette: YearbookPalette,
  t: TranslationSchema,
): void {
  const area = layout.shape
  sectionTitle(ctx, area, t.yearbook.sections.shape, palette)

  const columnWidth = area.w / 2
  const columns: Array<{ label: string; value: string }> = [
    {
      label: t.yearbook.busiestWeekday,
      value:
        model.timeShape.peakWeekday !== null
          ? t.common.weekdayLabel(t.common.weekdaysShort[model.timeShape.peakWeekday - 1] ?? '')
          : t.yearbook.noData,
    },
    {
      label: t.yearbook.busiestPeriod,
      value:
        model.timeShape.peakHour !== null
          ? formatPeakHour(model.timeShape.peakHour)
          : t.yearbook.noData,
    },
  ]
  columns.forEach((column, index) => {
    const x = area.x + index * columnWidth
    setFont(ctx, 600, 10)
    ctx.fillStyle = palette.ink2
    ctx.fillText(column.label, x, area.y + 34)
    setFont(ctx, 600, 16)
    ctx.fillStyle = palette.ink
    ctx.fillText(column.value, x, area.y + 54)
  })

  const topHabits =
    model.timeShape.topHabits.length > 0
      ? `${t.yearbook.topHabits}  ${model.timeShape.topHabits
          .map((habit, index) => `${index + 1}. ${habitLabel(t, habit.name)} · ${habit.count}`)
          .join('  ·  ')}`
      : `${t.yearbook.topHabits}  ${t.yearbook.noData}`
  setFont(ctx, 500, 12)
  ctx.fillStyle = palette.ink2
  ctx.fillText(truncateToWidth(ctx, topHabits, area.w), area.x, area.y + 74)
}

function drawQuote(
  ctx: CanvasRenderingContext2D,
  layout: YearbookLayout,
  model: YearbookModel,
  palette: YearbookPalette,
  t: TranslationSchema,
): void {
  const area = layout.quote

  if (!model.quote) {
    sectionTitle(ctx, area, t.yearbook.sections.quote, palette)
    setFont(ctx, 500, 12)
    ctx.fillStyle = palette.ink2
    ctx.fillText(t.yearbook.noData, area.x, area.y + 40)
    return
  }

  setFont(ctx, 500, 15)
  const lines = wrapTextToWidth(ctx, `“${model.quote.text}”`, area.w, 2)
  const lineHeight = 22
  const contentHeight = lines.length * lineHeight + 22
  // 建筑少的年份 quote 区会被撑高：把「标题 + 引文 + 署名」作为一整块垂直居中，
  // 读作书页上的题词，而不是「标题后丢了内容」。
  const blockHeight = 16 + 16 + contentHeight
  const topY = area.y + Math.max(0, (area.h - blockHeight) / 2)
  sectionTitle(ctx, { ...area, y: topY }, t.yearbook.sections.quote, palette)

  const startY = topY + 32
  ctx.fillStyle = palette.ink
  lines.forEach((line, index) => {
    ctx.fillText(line, area.x, startY + index * lineHeight)
  })

  setFont(ctx, 500, 11)
  ctx.fillStyle = palette.ink2
  ctx.fillText(
    truncateToWidth(
      ctx,
      `${t.yearbook.quoteFrom(habitLabel(t, model.quote.habitName))} · ${model.quote.date}`,
      area.w,
    ),
    area.x,
    startY + lines.length * lineHeight + 6,
  )
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  layout: YearbookLayout,
  model: YearbookModel,
  palette: YearbookPalette,
  t: TranslationSchema,
): void {
  const area = layout.footer
  drawRule(ctx, area.x, area.x + area.w, area.y, palette.line)
  setFont(ctx, 600, 10, FONT_NUM)
  ctx.fillStyle = palette.ink2
  ctx.fillText(t.yearbook.coverTitle, area.x, area.y + 18)
  ctx.textAlign = 'right'
  ctx.fillText(t.yearbook.yearTitle(model.year), area.x + area.w, area.y + 18)
  ctx.textAlign = 'left'
}

/** 绘制前等待字体就绪 + 一帧（避免 CJK 掉字/字重回退） */
export async function waitForYearbookFonts(doc: Document | undefined = document): Promise<void> {
  const fonts = (doc as (Document & { fonts?: FontFaceSet }) | undefined)?.fonts
  if (fonts?.ready) {
    try {
      await fonts.ready
    } catch {
      // 字体加载失败时用回退字族继续绘制，不阻塞导出
    }
  }
  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}

export interface YearbookDrawOptions {
  model: YearbookModel
  palette: YearbookPalette
  t: TranslationSchema
  lang: Language
}

/** 把年鉴绘制到 canvas（物理尺寸 = 逻辑尺寸 × DPR） */
export async function drawYearbook(
  canvas: HTMLCanvasElement,
  options: YearbookDrawOptions,
): Promise<void> {
  await waitForYearbookFonts()

  const { width, height, dpr } = YEARBOOK_CANVAS
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)

  const { model, palette, t, lang } = options
  const visibleCount = Math.min(model.buildings.length, YEARBOOK_MAX_BUILDINGS_TOTAL)
  const columns = visibleCount > YEARBOOK_MAX_BUILDINGS ? 2 : 1
  const buildingRows = Math.max(1, Math.ceil(visibleCount / columns))
  const buildingOverflow = Math.max(0, model.buildings.length - YEARBOOK_MAX_BUILDINGS_TOTAL)
  const layout = computeYearbookLayout(width, height, {
    buildingRows,
    overflow: buildingOverflow > 0,
  })

  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, width, height)

  drawHeader(ctx, layout, model, palette, t)

  if (!model.hasData) {
    ctx.textAlign = 'center'
    setFont(ctx, 700, 24)
    ctx.fillStyle = palette.ink
    ctx.fillText(t.yearbook.emptyTitle, width / 2, Math.round(height * 0.45))
    setFont(ctx, 500, 14)
    ctx.fillStyle = palette.ink2
    ctx.fillText(t.yearbook.emptyBody, width / 2, Math.round(height * 0.45) + 32)
    ctx.textAlign = 'left'
    drawFooter(ctx, layout, model, palette, t)
    return
  }

  const isoPalette = paletteFromDocument()
  drawOverview(ctx, layout, model, palette, t)
  drawMonths(ctx, layout, model, palette, t)
  drawBuildings(ctx, layout, model, palette, isoPalette, t, lang)
  drawShape(ctx, layout, model, palette, t)
  drawQuote(ctx, layout, model, palette, t)
  drawFooter(ctx, layout, model, palette, t)
}

/* ---------------- 导出 ---------------- */

export function yearbookPngFileName(year: number): string {
  return `blockhabit-yearbook-${year}.png`
}

export function yearbookMarkdownFileName(year: number): string {
  return `blockhabit-yearbook-${year}.md`
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  if (typeof canvas.toBlob !== 'function') return Promise.resolve(null)
  return new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    } catch {
      resolve(null)
    }
  })
}

/** 保存 PNG（下载）；返回是否成功。调用方负责 toast 文案 */
export async function saveYearbookPng(canvas: HTMLCanvasElement, year: number): Promise<boolean> {
  const blob = await canvasToPngBlob(canvas)
  if (!blob) return false
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = yearbookPngFileName(year)
    link.click()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return true
}

/** 复制 PNG 到剪贴板（ClipboardItem）；失败返回 false，由调用方回退提示 */
export async function copyYearbookPng(canvas: HTMLCanvasElement): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false
  const blob = await canvasToPngBlob(canvas)
  if (!blob) return false
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}
