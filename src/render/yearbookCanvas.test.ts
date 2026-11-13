import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { blueprints } from '../logic/blueprints'
import { buildYearbook, type YearbookState } from '../logic/yearbook'
import { zh } from '../i18n/locales/zh'
import { clearCubeSpriteCache } from './iso'
import {
  YEARBOOK_CANVAS,
  YEARBOOK_MAX_BUILDINGS,
  YEARBOOK_MAX_BUILDINGS_TOTAL,
  buildingGridRects,
  buildingRowRects,
  computeYearbookLayout,
  copyYearbookPng,
  drawYearbook,
  fitModelInto,
  measureModelBounds,
  metricCellRects,
  monthGridRects,
  readYearbookPalette,
  truncateToWidth,
  wrapTextToWidth,
  yearbookMarkdownFileName,
  yearbookPngFileName
} from './yearbookCanvas'

/**
 * 年鉴画布：只测纯布局函数 + 绘制调用契约（不做像素断言）。
 * jsdom 没有真实 2D context，这里用可记录调用的假 context 断言
 * 「物理尺寸 = 逻辑 × DPR」「fonts.ready 被 await」「文案确实画了」。
 */

interface RecordedCall {
  name: string
  args: unknown[]
}

function createFakeContext(): { ctx: CanvasRenderingContext2D; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const gradient = { addColorStop: () => undefined }
  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: String(text).length * 7 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    getTransform: () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 })
  }
  const proxy = new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop as string]
      if (typeof prop !== 'string') return undefined
      return (...args: unknown[]) => {
        calls.push({ name: prop, args })
      }
    },
    set(obj, prop, value) {
      obj[prop as string] = value
      return true
    }
  })
  return { ctx: proxy as unknown as CanvasRenderingContext2D, calls }
}

function emptyModel() {
  const state: YearbookState = {
    habits: [],
    checkIns: [],
    builds: [],
    dayClaims: [],
    deletedDayClaims: [],
    foundationNotes: {},
    completedBlueprintIds: []
  }
  return buildYearbook(state, 2026)
}

function dataModel() {
  const plant = blueprints.plant
  const builds = plant.blocks.map((_, index) => ({
    id: `p-${index}`,
    blueprintId: 'plant',
    index,
    placedAt: new Date(2026, 2, 1 + (index % 3), 12).toISOString(),
    fromHabitId: 'h1',
    bonus: false
  }))
  const state: YearbookState = {
    habits: [
      {
        id: 'h1',
        name: '晨间冥想',
        frequency: { type: 'daily' },
        createdAt: '2026-01-01T08:00:00.000Z'
      }
    ],
    checkIns: [
      {
        id: 'c1',
        habitId: 'h1',
        date: '2026-03-02',
        at: new Date(2026, 2, 2, 8, 0).toISOString(),
        note: '窗外有雨。'
      }
    ],
    builds,
    dayClaims: [
      {
        date: '2026-03-02',
        claimedAt: new Date(2026, 2, 2, 21, 0).toISOString(),
        blockId: 'dc-1',
        blueprintId: 'plant'
      }
    ],
    deletedDayClaims: [],
    foundationNotes: { plant: '从一颗种子开始。' },
    completedBlueprintIds: ['plant']
  }
  return buildYearbook(state, 2026)
}

/** 给 canvas 打一个同步 toBlob 桩（jsdom 无真实 2D context，toBlob 不可用） */
function stubPngBlob(canvas: HTMLCanvasElement, blob: Blob | null): void {
  Object.defineProperty(canvas, 'toBlob', {
    configurable: true,
    value: (callback: (value: Blob | null) => void) => callback(blob)
  })
}

/** 下载环境桩：URL.createObjectURL/revokeObjectURL + a[download].click */
function stubDownloadEnvironment() {
  const createObjectURL = vi.fn(() => 'blob:yearbook')
  const revokeObjectURL = vi.fn()
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })

  const anchors: HTMLAnchorElement[] = []
  const originalCreateElement = document.createElement.bind(document)
  const createElement = vi.spyOn(document, 'createElement').mockImplementation(((
    tagName: string,
    options?: ElementCreationOptions
  ) => {
    const element = originalCreateElement(tagName, options)
    if (tagName === 'a') anchors.push(element as HTMLAnchorElement)
    return element
  }) as typeof document.createElement)
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

  return {
    anchors,
    createObjectURL,
    click,
    restore() {
      createElement.mockRestore()
      click.mockRestore()
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: originalCreateObjectURL
      })
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: originalRevokeObjectURL
      })
    }
  }
}

/** 剪贴板桩：write 传 undefined 表示「浏览器不支持 clipboard」 */
function stubClipboard(write?: (items: unknown[]) => Promise<void>) {
  const originalItem = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem')
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(globalThis, 'ClipboardItem', {
    configurable: true,
    value: class MockClipboardItem {
      items: Record<string, Blob>
      constructor(items: Record<string, Blob>) {
        this.items = items
      }
    }
  })
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: write ? { write: vi.fn(write) } : undefined
  })
  return () => {
    if (originalItem) Object.defineProperty(globalThis, 'ClipboardItem', originalItem)
    else delete (globalThis as { ClipboardItem?: unknown }).ClipboardItem
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
    else delete (navigator as { clipboard?: unknown }).clipboard
  }
}

let fake: ReturnType<typeof createFakeContext>
let getContextSpy: ReturnType<typeof vi.spyOn>
let fontsInstalled = false

function installFonts(ready: Promise<unknown>): void {
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready } })
  fontsInstalled = true
}

beforeEach(() => {
  clearCubeSpriteCache()
  fake = createFakeContext()
  getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation((() => fake.ctx) as unknown as HTMLCanvasElement['getContext'])
})

afterEach(() => {
  getContextSpy.mockRestore()
  clearCubeSpriteCache()
  if (fontsInstalled) {
    delete (document as unknown as { fonts?: unknown }).fonts
    fontsInstalled = false
  }
})

describe('年鉴布局（纯函数）', () => {
  it('逻辑尺寸 720×1200、导出 DPR 2 → 1440×2400', () => {
    expect(YEARBOOK_CANVAS).toEqual({ width: 720, height: 1200, dpr: 2 })
  })

  it('区块在画布内且自上而下不重叠', () => {
    const layout = computeYearbookLayout()
    const sections = [
      layout.header,
      layout.overview,
      layout.months,
      layout.buildings,
      layout.shape,
      layout.quote,
      layout.footer
    ]
    for (const rect of sections) {
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.w).toBeLessThanOrEqual(layout.width)
      expect(rect.y + rect.h).toBeLessThanOrEqual(layout.height)
    }
    for (let index = 1; index < sections.length; index++) {
      expect(sections[index].y).toBeGreaterThanOrEqual(
        sections[index - 1].y + sections[index - 1].h
      )
    }
  })

  it('metricCellRects：7 项 → 4 列 2 行，全部落在区域内', () => {
    const layout = computeYearbookLayout()
    const area = { ...layout.overview, y: layout.overview.y + 26 }
    const cells = metricCellRects(area)
    expect(cells).toHaveLength(7)
    expect(cells[0].y).toBe(cells[3].y)
    expect(cells[4].y).toBeGreaterThan(cells[0].y)
    for (const cell of cells) {
      expect(cell.x).toBeGreaterThanOrEqual(area.x)
      expect(cell.x + cell.w).toBeLessThanOrEqual(area.x + area.w + 0.001)
      expect(cell.y + cell.h).toBeLessThanOrEqual(area.y + area.h)
    }
  })

  it('monthGridRects：12 行 × 31 格，全部落在月份区域内', () => {
    const layout = computeYearbookLayout()
    const rows = monthGridRects(layout.months)
    expect(rows).toHaveLength(12)
    expect(rows[0].cells).toHaveLength(31)
    const lastCell = rows[11].cells[30]
    expect(lastCell.x + lastCell.w).toBeLessThanOrEqual(layout.months.x + layout.months.w)
    expect(rows[11].cells[0].y + 13).toBeLessThanOrEqual(layout.months.y + layout.months.h)
  })

  it('建筑少时建筑区收缩、当年一句区增高，页脚仍贴底且区块不重叠', () => {
    const full = computeYearbookLayout()
    const sparse = computeYearbookLayout(720, 1200, { buildingRows: 2 })
    expect(sparse.buildings.h).toBeLessThan(full.buildings.h)
    expect(sparse.quote.h).toBeGreaterThan(full.quote.h)
    expect(sparse.footer.y).toBe(full.footer.y)
    expect(sparse.shape.y).toBeGreaterThanOrEqual(sparse.buildings.y + sparse.buildings.h)
    expect(sparse.quote.y).toBeGreaterThanOrEqual(sparse.shape.y + sparse.shape.h)
    expect(sparse.quote.y + sparse.quote.h).toBeLessThanOrEqual(sparse.footer.y)
  })

  it('建筑超过单页上限时留一行 +N 溢出位', () => {
    const withOverflow = computeYearbookLayout(720, 1200, { buildingRows: 5, overflow: true })
    expect(withOverflow.buildings.h).toBe(18 + 5 * 52 + 24)
  })

  it('buildingRowRects：最多 6 行，缩略图与文字区都在建筑区内', () => {
    const layout = computeYearbookLayout()
    const rows = buildingRowRects(layout.buildings, YEARBOOK_MAX_BUILDINGS)
    expect(rows).toHaveLength(6)
    for (const row of rows) {
      expect(row.thumb.x + row.thumb.w).toBeLessThanOrEqual(layout.buildings.x + layout.buildings.w)
      expect(row.thumb.y + row.thumb.h).toBeLessThanOrEqual(layout.buildings.y + layout.buildings.h)
      expect(row.textWidth).toBeGreaterThan(0)
    }
    expect(rows[5].row.y + rows[5].row.h).toBeLessThanOrEqual(
      layout.buildings.y + layout.buildings.h
    )
  })
})

describe('模型适配（纯函数）', () => {
  it('measureModelBounds：非空模型有正包围盒，空模型返回零', () => {
    const bounds = measureModelBounds(blueprints.plant.blocks)
    expect(bounds.maxX - bounds.minX).toBeGreaterThan(0)
    expect(bounds.maxY - bounds.minY).toBeGreaterThan(0)
    expect(measureModelBounds([])).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 })
  })

  it('fitModelInto：等比缩放不超上限，且模型落在视口 pad 内', () => {
    const bounds = measureModelBounds(blueprints.castle.blocks)
    const viewport = { x: 10, y: 20, w: 120, h: 90 }
    const fit = fitModelInto(bounds, viewport, 6, 0.7)
    expect(fit.scale).toBeGreaterThan(0)
    expect(fit.scale).toBeLessThanOrEqual(0.7)
    const left = bounds.minX * fit.scale + fit.panX
    const right = bounds.maxX * fit.scale + fit.panX
    const top = bounds.minY * fit.scale + fit.panY
    const bottom = bounds.maxY * fit.scale + fit.panY
    expect(left).toBeGreaterThanOrEqual(viewport.x + 6 - 0.001)
    expect(right).toBeLessThanOrEqual(viewport.x + viewport.w - 6 + 0.001)
    expect(top).toBeGreaterThanOrEqual(viewport.y + 6 - 0.001)
    expect(bottom).toBeLessThanOrEqual(viewport.y + viewport.h - 6 + 0.001)
  })

  it('truncateToWidth / wrapTextToWidth：按测量宽度截断与折行', () => {
    const measureCtx = {
      measureText: (text: string) => ({ width: text.length * 10 })
    } as unknown as Pick<CanvasRenderingContext2D, 'measureText'>
    expect(truncateToWidth(measureCtx, '短', 100)).toBe('短')
    const truncated = truncateToWidth(measureCtx, '这是一段很长的文字', 60)
    expect(truncated.endsWith('...')).toBe(true)
    expect(truncated.length).toBeLessThanOrEqual(6)

    const lines = wrapTextToWidth(measureCtx, '一二三四五六七八九十一二三四五', 50, 2)
    expect(lines.length).toBeLessThanOrEqual(2)
    expect(lines.length).toBeGreaterThan(0)
  })
})

describe('主题令牌', () => {
  it('readYearbookPalette：读不到 CSS 变量时回退到纸白主题令牌值（不出现空色）', () => {
    const palette = readYearbookPalette()
    for (const value of Object.values(palette)) {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })
})

describe('绘制与导出', () => {
  it('drawYearbook：物理尺寸 = 逻辑 × DPR，且绘制前 await document.fonts.ready', async () => {
    let resolveFonts!: () => void
    const ready = new Promise<void>((resolve) => {
      resolveFonts = resolve
    })
    installFonts(ready)
    const canvas = document.createElement('canvas')
    const drawing = drawYearbook(canvas, {
      model: emptyModel(),
      palette: readYearbookPalette(),
      t: zh,
      lang: 'zh'
    })
    await Promise.resolve()
    // 字体未就绪前不设置画布尺寸（避免 CJK 掉字后无法重绘）
    expect(canvas.width).toBe(300)
    expect(canvas.height).toBe(150)
    resolveFonts()
    await drawing
    expect(canvas.width).toBe(YEARBOOK_CANVAS.width * YEARBOOK_CANVAS.dpr)
    expect(canvas.height).toBe(YEARBOOK_CANVAS.height * YEARBOOK_CANVAS.dpr)
    expect(fake.calls.some((call) => call.name === 'fillRect')).toBe(true)
  })

  it('有数据时绘制标题/统计/月份/建筑年表/随笔文案', async () => {
    installFonts(Promise.resolve())
    const canvas = document.createElement('canvas')
    await drawYearbook(canvas, {
      model: dataModel(),
      palette: readYearbookPalette(),
      t: zh,
      lang: 'zh'
    })
    const texts = fake.calls
      .filter((call) => call.name === 'fillText')
      .map((call) => String(call.args[0]))
    expect(texts).toContain(zh.yearbook.coverTitle)
    expect(texts).toContain('2026')
    expect(texts).toContain(zh.yearbook.sections.overview)
    expect(texts).toContain(zh.yearbook.sections.months)
    expect(texts).toContain(zh.yearbook.sections.buildings)
    expect(texts).toContain(zh.yearbook.sections.shape)
    expect(texts).toContain(zh.yearbook.sections.quote)
    expect(texts.some((text) => text.includes(zh.blueprints.plant))).toBe(true)
    expect(texts.some((text) => text.includes('窗外有雨。'))).toBe(true)
  })

  it('空年份绘制诚实空态而不是伪造数字', async () => {
    installFonts(Promise.resolve())
    const canvas = document.createElement('canvas')
    await drawYearbook(canvas, {
      model: emptyModel(),
      palette: readYearbookPalette(),
      t: zh,
      lang: 'zh'
    })
    const texts = fake.calls
      .filter((call) => call.name === 'fillText')
      .map((call) => String(call.args[0]))
    expect(texts).toContain(zh.yearbook.emptyTitle)
    expect(texts).toContain(zh.yearbook.emptyBody)
  })

  it('导出文件名含年份', () => {
    expect(yearbookPngFileName(2026)).toBe('blockhabit-yearbook-2026.png')
    expect(yearbookMarkdownFileName(2026)).toBe('blockhabit-yearbook-2026.md')
  })

  it('复制成功：返回 copied，不触发下载', async () => {
    const download = stubDownloadEnvironment()
    const restoreClipboard = stubClipboard(() => Promise.resolve())
    try {
      const canvas = document.createElement('canvas')
      const blob = new Blob(['png'], { type: 'image/png' })
      stubPngBlob(canvas, blob)
      await expect(copyYearbookPng(canvas, 2026)).resolves.toBe('copied')
      expect(download.anchors).toHaveLength(0)
      expect(download.click).not.toHaveBeenCalled()
    } finally {
      restoreClipboard()
      download.restore()
    }
  })

  it('剪贴板被拒绝（NotAllowedError）：自动降级下载 PNG，返回 downloaded', async () => {
    const download = stubDownloadEnvironment()
    const restoreClipboard = stubClipboard(() =>
      Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'))
    )
    try {
      const canvas = document.createElement('canvas')
      const blob = new Blob(['png'], { type: 'image/png' })
      stubPngBlob(canvas, blob)
      await expect(copyYearbookPng(canvas, 2026)).resolves.toBe('downloaded')
      // 复用保存逻辑：blob → objectURL → a[download].click
      expect(download.createObjectURL).toHaveBeenCalledWith(blob)
      expect(download.anchors).toHaveLength(1)
      expect(download.anchors[0].download).toBe(yearbookPngFileName(2026))
      expect(download.click).toHaveBeenCalledTimes(1)
    } finally {
      restoreClipboard()
      download.restore()
    }
  })

  it('剪贴板不可用（无 ClipboardItem / navigator.clipboard）：直接下载 PNG', async () => {
    const download = stubDownloadEnvironment()
    const restoreClipboard = stubClipboard(undefined)
    try {
      const canvas = document.createElement('canvas')
      stubPngBlob(canvas, new Blob(['png'], { type: 'image/png' }))
      await expect(copyYearbookPng(canvas, 2026)).resolves.toBe('downloaded')
      expect(download.click).toHaveBeenCalledTimes(1)
    } finally {
      restoreClipboard()
      download.restore()
    }
  })

  it('toBlob 为空：返回 failed，不触发下载', async () => {
    const download = stubDownloadEnvironment()
    const restoreClipboard = stubClipboard(() => Promise.resolve())
    try {
      const canvas = document.createElement('canvas')
      stubPngBlob(canvas, null)
      await expect(copyYearbookPng(canvas, 2026)).resolves.toBe('failed')
      expect(download.click).not.toHaveBeenCalled()
    } finally {
      restoreClipboard()
      download.restore()
    }
  })

  it('两列建筑网格：单页可放 12 座且两列不重叠', () => {
    const layout = computeYearbookLayout(720, 1200, { buildingRows: 6 })
    const cells = buildingGridRects(layout.buildings, 6, 2)
    expect(cells).toHaveLength(YEARBOOK_MAX_BUILDINGS_TOTAL)
    const left = cells.filter((_, index) => index < 6)
    const right = cells.filter((_, index) => index >= 6)
    expect(left.every((cell) => cell.row.x + cell.row.w <= right[0].row.x)).toBe(true)
    expect(
      cells.every((cell) => cell.row.y + cell.row.h <= layout.buildings.y + layout.buildings.h)
    ).toBe(true)
  })
})
