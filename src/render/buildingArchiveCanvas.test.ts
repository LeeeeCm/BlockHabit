import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CheckIn, Habit, PlacedBlock } from '../types'
import { blueprints } from '../logic/blueprints'
import {
  buildBuildingArchive,
  type ArchiveMilestone,
  type BuildingArchiveState,
} from '../logic/buildingArchive'
import { zh } from '../i18n/locales/zh'
import { en } from '../i18n/locales/en'
import { clearCubeSpriteCache } from './iso'
import {
  ARCHIVE_CARD,
  ARCHIVE_STAGE,
  archiveMilestoneHabitName,
  archiveMilestoneLabel,
  archivePngFileName,
  drawArchiveCard,
  drawArchiveStage,
  renderArchiveCardCanvas,
} from './buildingArchiveCanvas'

/**
 * 建筑档案卡画布（B3 / D-20261110-065）：
 * 只测尺寸契约、字体等待、绘制调用契约与纯文案回退，不做像素断言。
 * jsdom 没有真实 2D context，这里用可记录调用的假 context 断言
 * 「物理尺寸 = 逻辑 × DPR」「fonts.ready 被 await」「文案/模型确实画了」。
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
    getTransform: () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }),
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
    },
  })
  return { ctx: proxy as unknown as CanvasRenderingContext2D, calls }
}

const CREATED = '2024-01-01T00:00:00.000Z'

function habit(id: string, name: string): Habit {
  return { id, name, frequency: { type: 'daily' }, createdAt: CREATED }
}

function atLocal(date: string, hour = 12): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, hour, 0).toISOString()
}

/** 6 块 plant 全部落下（2026-03-01 … 2026-03-06），可选覆盖单块 */
function plantBlocks(over: Record<number, Partial<PlacedBlock>> = {}): PlacedBlock[] {
  return blueprints.plant.blocks.map((_, index) => ({
    id: 'plant-' + index,
    blueprintId: 'plant',
    index,
    placedAt: atLocal('2026-03-0' + (index + 1)),
    fromHabitId: 'h1',
    bonus: false,
    ...over[index],
  }))
}

function makeState(over: Partial<BuildingArchiveState> = {}): BuildingArchiveState {
  return {
    builds: plantBlocks(),
    checkIns: [],
    habits: [habit('h1', '晨间冥想')],
    foundationNotes: {},
    completedBlueprintIds: ['plant'],
    ...over,
  }
}

function milestone(over: Partial<ArchiveMilestone> = {}): ArchiveMilestone {
  return {
    index: 0,
    kind: 'first',
    date: '2026-03-01',
    blockId: 'plant-0',
    fromHabitId: 'h1',
    habitId: 'h1',
    habitName: '晨间冥想',
    bonus: false,
    ...over,
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

describe('画布尺寸契约', () => {
  it('档案卡 640×880@2x、弹层舞台 640×260@2x', () => {
    expect(ARCHIVE_CARD).toEqual({ width: 640, height: 880, dpr: 2 })
    expect(ARCHIVE_STAGE).toEqual({ width: 640, height: 260, dpr: 2 })
    expect(archivePngFileName('castle')).toBe('blockhabit-archive-castle.png')
  })
})

describe('关键块文案（纯函数，zh/en 齐全）', () => {
  it('首块 / 中间百分比 / 末块标签', () => {
    expect(archiveMilestoneLabel(zh, milestone({ kind: 'first' }))).toBe(zh.buildingArchive.firstBlock)
    expect(archiveMilestoneLabel(zh, milestone({ kind: 'percent', percent: 50 }))).toBe('50%')
    expect(archiveMilestoneLabel(zh, milestone({ kind: 'last' }))).toBe(zh.buildingArchive.lastBlock)
    expect(archiveMilestoneLabel(en, milestone({ kind: 'last' }))).toBe(en.buildingArchive.lastBlock)
  })

  it('习惯名回退：全勤块 / 已删除习惯 / 无打卡关联，不伪造名字', () => {
    expect(archiveMilestoneHabitName(zh, milestone())).toBe('晨间冥想')
    expect(
      archiveMilestoneHabitName(zh, milestone({ habitName: '', fromHabitId: '__day__' })),
    ).toBe(zh.today.fullCard.bonusHabitName)
    expect(
      archiveMilestoneHabitName(zh, milestone({ habitName: '', checkInId: 'c1' })),
    ).toBe(zh.today.fullCard.deletedHabitName)
    expect(archiveMilestoneHabitName(zh, milestone({ habitName: '' }))).toBe('—')
  })
})

describe('绘制契约', () => {
  it('drawArchiveStage：物理尺寸 = 逻辑 × DPR，且绘制前 await document.fonts.ready', async () => {
    let resolveFonts!: () => void
    const ready = new Promise<void>((resolve) => {
      resolveFonts = resolve
    })
    installFonts(ready)
    const canvas = document.createElement('canvas')
    const drawing = drawArchiveStage(canvas, blueprints.plant, [])
    await Promise.resolve()
    // 字体未就绪前不设置画布尺寸（避免 CJK 掉字后无法重绘）
    expect(canvas.width).toBe(300)
    expect(canvas.height).toBe(150)
    resolveFonts()
    await drawing
    expect(canvas.width).toBe(ARCHIVE_STAGE.width * ARCHIVE_STAGE.dpr)
    expect(canvas.height).toBe(ARCHIVE_STAGE.height * ARCHIVE_STAGE.dpr)
    expect(fake.calls.some((call) => call.name === 'fillRect')).toBe(true)
    expect(fake.calls.some((call) => call.name === 'drawImage')).toBe(true)
  })

  it('drawArchiveCard：尺寸 1280×1760，标题/建筑名/落成日/数据格/时间线/铭言都画了', async () => {
    installFonts(Promise.resolve())
    const canvas = document.createElement('canvas')
    const archive = buildBuildingArchive(
      makeState({
        checkIns: [
          {
            id: 'c1',
            habitId: 'h1',
            date: '2026-03-01',
            at: atLocal('2026-03-01'),
            placedBlockId: 'plant-0',
            note: '第一块，窗外有雨。',
          } satisfies CheckIn,
        ],
        foundationNotes: { plant: '从一颗种子开始。' },
      }),
      'plant',
    )
    await drawArchiveCard(canvas, {
      archive,
      blueprint: blueprints.plant,
      blueprintName: zh.blueprints.plant,
      t: zh,
      lang: 'zh',
    })
    expect(canvas.width).toBe(ARCHIVE_CARD.width * ARCHIVE_CARD.dpr)
    expect(canvas.height).toBe(ARCHIVE_CARD.height * ARCHIVE_CARD.dpr)
    const texts = fake.calls
      .filter((call) => call.name === 'fillText')
      .map((call) => String(call.args[0]))
    expect(texts).toContain(zh.buildingArchive.title.toUpperCase())
    expect(texts.some((text) => text.includes(zh.blueprints.plant))).toBe(true)
    expect(texts.some((text) => text.includes(archive.completedAt ?? ''))).toBe(true)
    for (const label of Object.values(zh.buildingArchive.metrics)) {
      expect(texts).toContain(label)
    }
    expect(texts).toContain(zh.buildingArchive.timeline)
    expect(texts).toContain(zh.buildingArchive.noteLabel)
    expect(texts.some((text) => text.includes('从一颗种子开始。'))).toBe(true)
    expect(texts).toContain('BLOCKHABIT · ' + zh.buildingArchive.title)
  })

  it('drawArchiveCard：无铭言时不画铭言标签（不伪造内容）', async () => {
    installFonts(Promise.resolve())
    const canvas = document.createElement('canvas')
    await drawArchiveCard(canvas, {
      archive: buildBuildingArchive(makeState(), 'plant'),
      blueprint: blueprints.plant,
      blueprintName: zh.blueprints.plant,
      t: zh,
      lang: 'zh',
    })
    const texts = fake.calls
      .filter((call) => call.name === 'fillText')
      .map((call) => String(call.args[0]))
    expect(texts).not.toContain(zh.buildingArchive.noteLabel)
  })

  it('renderArchiveCardCanvas：返回离屏画布并打上 data-testid="archive-card-canvas"（自动化断言用）', async () => {
    installFonts(Promise.resolve())
    const archive = buildBuildingArchive(makeState(), 'plant')
    const canvas = await renderArchiveCardCanvas({
      archive,
      blueprint: blueprints.plant,
      blueprintName: en.blueprints.plant,
      t: en,
      lang: 'en',
    })
    expect(canvas.dataset.testid).toBe('archive-card-canvas')
    expect(canvas.width).toBe(ARCHIVE_CARD.width * ARCHIVE_CARD.dpr)
    expect(canvas.height).toBe(ARCHIVE_CARD.height * ARCHIVE_CARD.dpr)
    const texts = fake.calls
      .filter((call) => call.name === 'fillText')
      .map((call) => String(call.args[0]))
    // 画布排版例外：zh 用书名号，en 裸名（与年鉴一致）
    expect(texts).toContain(en.blueprints.plant)
  })
})
