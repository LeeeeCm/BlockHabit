import type { AppState, CheckIn, DayClaim, Habit, PlacedBlock } from '../types'
import type { TranslationSchema } from '../i18n/types'
import { addDays, dateKey, parseKey, weekStart } from './dates'
import { habitActiveOnDay, isHabitDueOnDay } from './checkin'
import { blueprints } from './blueprints'

/**
 * 落成年鉴（D-20261110-060）纯逻辑层。
 *
 * 全部数据从现有 AppState 派生，**不新增持久化字段**：
 * - checkIns / builds / dayClaims 一律排除墓碑（与统计页、sync 合并同口径）；
 * - 日期归属按本地日期键前缀（checkIns.date 已是本地 YYYY-MM-DD）；
 *   builds.placedAt 是 ISO UTC，先转本地 dateKey 再取年份，避免时区漂移；
 * - 建筑「落成」只由规则判定：该蓝图块数 ≥ 蓝图容量（completedBlueprintIds 顺序不可靠，
 *   sync/merge 会按 id 字母序重排，不能当作落成顺序，也不作为完成态的唯一事实源）；
 * - 空年份不生成任何伪造数字（hasData=false，UI 走诚实空态）。
 *
 * 时间口径已知限制：checkIns.at 是 ISO UTC，最常时段按当前设备本地时区还原；
 * 跨时区旅行会让历史时段轻微漂移，这里不做补偿（诚实限制）。
 */

/** buildYearbook 需要的 AppState 切片（AppState 可直接传入） */
export type YearbookState = Pick<
  AppState,
  | 'habits'
  | 'checkIns'
  | 'builds'
  | 'dayClaims'
  | 'deletedDayClaims'
  | 'foundationNotes'
  | 'completedBlueprintIds'
>

export interface YearbookStats {
  /** 当年有效打卡次数 */
  checkIns: number
  /** 当年落下的积木数（placedAt 本地日期在当年） */
  blocks: number
  /** 当年落成的建筑数 */
  completedBuildings: number
  /** 当年全勤领取天数（dayClaims 去墓碑） */
  perfectDays: number
  /** 最长全勤连击：当年连续领取全勤的最长天数 */
  longestStreak: number
  /** 当年专注分钟（只累加 actualMinutes，不把 targetMinutes 当事实） */
  focusMinutes: number
  /** 当年随笔条数（note 非空） */
  notes: number
}

export interface YearbookDay {
  /** 本地日期键 YYYY-MM-DD */
  key: string
  /** 几号（1..31） */
  day: number
  /** 当日各习惯完成比例 0~1；-1 = 当天没有任何在册习惯（无数据） */
  ratio: number
  /** 是否晚于 now（未来日，画布画空心格） */
  future: boolean
  /** 当天是否领取过全勤（dayClaims 去墓碑） */
  claimed: boolean
}

export interface MonthBucket {
  /** 1..12 */
  month: number
  days: YearbookDay[]
  /** 当月有效打卡次数 */
  checkIns: number
}

export interface BuildingEntry {
  blueprintId: string
  /** 落成日（本地日期键）：该蓝图全部积木 placedAt 的最大值转本地日期 */
  completedAt: string | null
  /** 首块落下日（本地日期键） */
  firstPlacedAt: string | null
  /** 首块 → 落成的日历天数（含首尾，同日落成为 1） */
  days: number | null
  /** 该建筑块数（= 蓝图容量） */
  blocks: number
  /** 奠基石铭言（有则显示） */
  foundationNote?: string
}

export interface YearbookTopHabit {
  habitId: string
  /** 习惯名；习惯已不在存档里时为空串，由展示层回退 */
  name: string
  count: number
}

export interface YearbookTimeShape {
  /** 最常打卡时段 0..23；无有效 at 时为 null */
  peakHour: number | null
  /** 最常打卡星期 1=周一 … 7=周日；当年无打卡时为 null */
  peakWeekday: number | null
  /** 当年打卡最多的前 3 个习惯（只陈述次数，不评分） */
  topHabits: YearbookTopHabit[]
}

export interface YearbookQuote {
  text: string
  /** 署名习惯名；习惯已不在存档里时为空串 */
  habitName: string
  date: string
  starred: boolean
}

export interface YearbookModel {
  year: number
  stats: YearbookStats
  /** 固定 12 个月（2 月按当年真实天数） */
  months: MonthBucket[]
  /** 当年落成的建筑，按落成日升序 */
  buildings: BuildingEntry[]
  timeShape: YearbookTimeShape
  quote: YearbookQuote | null
  hasData: boolean
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

function isValidDateKey(key: string | undefined | null): key is string {
  return (
    typeof key === 'string' && DATE_KEY_RE.test(key) && Number.isFinite(parseKey(key).getTime())
  )
}

/** 本地日期键 → 年份；非法键返回 null */
function yearOfKey(key: string | undefined | null): number | null {
  if (!isValidDateKey(key)) return null
  return Number(key.slice(0, 4))
}

/** ISO UTC 时间戳 → 本地日期键；非法返回 null */
function localDateKeyOfIso(iso: string | undefined | null): string | null {
  if (typeof iso !== 'string' || iso.length === 0) return null
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  return dateKey(new Date(ms))
}

function liveCheckIns(state: YearbookState): CheckIn[] {
  return state.checkIns.filter((c) => !c.deletedAt)
}

function liveBuilds(state: YearbookState): PlacedBlock[] {
  return state.builds.filter((b) => !b.deletedAt)
}

/**
 * 有效全勤领取（与 src/sync/merge.ts 的 LWW 口径一致）：
 * 同一日期存在 deletedAt >= claimedAt 的墓碑 → 该日不算领取。
 */
function liveDayClaims(state: YearbookState): DayClaim[] {
  const latestDeleted = new Map<string, string>()
  for (const tomb of state.deletedDayClaims ?? []) {
    if (!tomb?.date || !tomb.deletedAt) continue
    const prev = latestDeleted.get(tomb.date)
    if (prev === undefined || tomb.deletedAt > prev) latestDeleted.set(tomb.date, tomb.deletedAt)
  }
  return (state.dayClaims ?? []).filter((claim) => {
    const deletedAt = latestDeleted.get(claim.date)
    return !(deletedAt !== undefined && deletedAt >= claim.claimedAt)
  })
}

function buildsOfBlueprint(state: YearbookState, blueprintId: string): PlacedBlock[] {
  return liveBuilds(state).filter((b) => b.blueprintId === blueprintId)
}

/** 一组积木 placedAt 的最大值 → 本地日期键 */
function maxPlacedDateKey(blocks: PlacedBlock[]): string | null {
  let maxMs = -Infinity
  for (const b of blocks) {
    const ms = Date.parse(b.placedAt)
    if (Number.isFinite(ms) && ms > maxMs) maxMs = ms
  }
  return maxMs === -Infinity ? null : dateKey(new Date(maxMs))
}

/** 一组积木 placedAt 的最小值 → 本地日期键 */
function minPlacedDateKey(blocks: PlacedBlock[]): string | null {
  let minMs = Infinity
  for (const b of blocks) {
    const ms = Date.parse(b.placedAt)
    if (Number.isFinite(ms) && ms < minMs) minMs = ms
  }
  return minMs === Infinity ? null : dateKey(new Date(minMs))
}

/** 首块 → 落成的日历天数（含首尾；同日落成 = 1） */
function calendarDaysBetween(first: string, last: string): number {
  const diff = Math.round((parseKey(last).getTime() - parseKey(first).getTime()) / DAY_MS)
  return Math.max(1, diff + 1)
}

/** 最长连续日期段（输入为日期键，重复日期先去重） */
function longestDayRun(dates: string[]): number {
  const sorted = [...new Set(dates)].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const key of sorted) {
    run = prev !== null && dateKey(addDays(parseKey(prev), 1)) === key ? run + 1 : 1
    if (run > best) best = run
    prev = key
  }
  return best
}

/** Map 计数中取最大者；并列时取更小的键（确定、可复现） */
function peakOf(counts: Map<number, number>): number | null {
  let peak: number | null = null
  let peakCount = 0
  for (const key of [...counts.keys()].sort((a, b) => a - b)) {
    const count = counts.get(key) ?? 0
    if (count > peakCount) {
      peak = key
      peakCount = count
    }
  }
  return peak
}

/**
 * 某蓝图的落成日（本地日期键）：
 * 块数未达蓝图容量（旧档 / 撤销 / 未知蓝图）→ null，不伪造日期。
 */
export function completionDateOf(state: YearbookState, blueprintId: string): string | null {
  const blueprint = blueprints[blueprintId]
  if (!blueprint) return null
  const blocks = buildsOfBlueprint(state, blueprintId)
  if (blocks.length < blueprint.blocks.length) return null
  return maxPlacedDateKey(blocks)
}

/** 有事实数据的年份（打卡 / 积木 / 全勤），降序 */
export function availableYears(state: YearbookState): number[] {
  const years = new Set<number>()
  for (const c of liveCheckIns(state)) {
    const y = yearOfKey(c.date)
    if (y !== null) years.add(y)
  }
  for (const b of liveBuilds(state)) {
    const y = yearOfKey(localDateKeyOfIso(b.placedAt))
    if (y !== null) years.add(y)
  }
  for (const claim of liveDayClaims(state)) {
    const y = yearOfKey(claim.date)
    if (y !== null) years.add(y)
  }
  return [...years].sort((a, b) => b - a)
}

function buildBuildingEntries(state: YearbookState, year: number): BuildingEntry[] {
  const entries: BuildingEntry[] = []
  for (const blueprintId of Object.keys(blueprints)) {
    const blueprint = blueprints[blueprintId]
    const blocks = buildsOfBlueprint(state, blueprintId)
    // 只算「已落成」：块数达到蓝图容量；不足（旧档/撤销）不计，也不推测年份
    if (blocks.length < blueprint.blocks.length) continue
    const completedAt = maxPlacedDateKey(blocks)
    if (yearOfKey(completedAt) !== year) continue
    const firstPlacedAt = minPlacedDateKey(blocks)
    const note = state.foundationNotes?.[blueprintId]?.trim()
    entries.push({
      blueprintId,
      completedAt,
      firstPlacedAt,
      days: firstPlacedAt ? calendarDaysBetween(firstPlacedAt, completedAt!) : null,
      blocks: blueprint.blocks.length,
      foundationNote: note ? note : undefined
    })
  }
  entries.sort(
    (a, b) =>
      (a.completedAt ?? '').localeCompare(b.completedAt ?? '') ||
      a.blueprintId.localeCompare(b.blueprintId)
  )
  return entries
}

function pickQuote(checkIns: CheckIn[], habitById: Map<string, Habit>): YearbookQuote | null {
  const candidates = checkIns.filter((c) => !!c.note?.trim())
  if (candidates.length === 0) return null
  // 规则：星标优先 → 文本更长优先 → 更早优先 → id 决胜（完全确定）
  const sorted = [...candidates].sort((a, b) => {
    const starA = a.starred ? 1 : 0
    const starB = b.starred ? 1 : 0
    if (starA !== starB) return starB - starA
    const lenA = a.note!.trim().length
    const lenB = b.note!.trim().length
    if (lenA !== lenB) return lenB - lenA
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.id.localeCompare(b.id)
  })
  const picked = sorted[0]
  return {
    text: picked.note!.trim(),
    habitName: habitById.get(picked.habitId)?.name ?? '',
    date: picked.date,
    starred: picked.starred === true
  }
}

function buildTimeShape(checkIns: CheckIn[], habitById: Map<string, Habit>): YearbookTimeShape {
  const weekdayCounts = new Map<number, number>()
  const hourCounts = new Map<number, number>()
  const habitCounts = new Map<string, number>()
  for (const c of checkIns) {
    const day = parseKey(c.date)
    const isoWeekday = day.getDay() === 0 ? 7 : day.getDay()
    weekdayCounts.set(isoWeekday, (weekdayCounts.get(isoWeekday) ?? 0) + 1)
    habitCounts.set(c.habitId, (habitCounts.get(c.habitId) ?? 0) + 1)
    const atMs = Date.parse(c.at)
    if (Number.isFinite(atMs)) {
      const hour = new Date(atMs).getHours()
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
    }
  }

  const topHabits = [...habitCounts.entries()]
    .map(([habitId, count]) => {
      const habit = habitById.get(habitId)
      return {
        habitId,
        name: habit?.name ?? '',
        count,
        // 并列规则：打卡数降序 → 习惯创建时间升序 → id 升序（稳定、可复现）
        createdAt: habit?.createdAt ?? ''
      }
    })
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.habitId.localeCompare(b.habitId)
    )
    .slice(0, 3)
    .map(({ habitId, name, count }) => ({ habitId, name, count }))

  return {
    peakHour: peakOf(hourCounts),
    peakWeekday: peakOf(weekdayCounts),
    topHabits
  }
}

/** 单遍索引：把逐日 × 逐习惯 × 全量 checkIns 的过滤降为 O(1) 查表（独立验证 P2-2） */
type CheckInIndex = {
  dates: Map<string, Set<string>>
  dayValues: Map<string, Map<string, number>>
  weekCounts: Map<string, Map<string, number>>
}

function buildCheckInIndex(checkIns: CheckIn[]): CheckInIndex {
  const dates = new Map<string, Set<string>>()
  const dayValues = new Map<string, Map<string, number>>()
  const weekCounts = new Map<string, Map<string, number>>()
  for (const c of checkIns) {
    if (c.deletedAt) continue
    let set = dates.get(c.habitId)
    if (!set) {
      set = new Set()
      dates.set(c.habitId, set)
    }
    set.add(c.date)
    if (typeof c.value === 'number') {
      let values = dayValues.get(c.habitId)
      if (!values) {
        values = new Map()
        dayValues.set(c.habitId, values)
      }
      values.set(c.date, (values.get(c.date) ?? 0) + c.value)
    }
    const weekKey = dateKey(weekStart(parseKey(c.date)))
    let weeks = weekCounts.get(c.habitId)
    if (!weeks) {
      weeks = new Map()
      weekCounts.set(c.habitId, weeks)
    }
    weeks.set(weekKey, (weeks.get(weekKey) ?? 0) + 1)
  }
  return { dates, dayValues, weekCounts }
}

/** 与 habitMetOnDay 同语义的索引版（weekly/counter/custom 全部覆盖） */
function habitMetWithIndex(habit: Habit, index: CheckInIndex, day: string): boolean {
  if (habit.frequency.type === 'custom' && !isHabitDueOnDay(habit, day)) return true
  if (habit.kind === 'counter' && habit.targetValue) {
    return (index.dayValues.get(habit.id)?.get(day) ?? 0) >= habit.targetValue
  }
  if (habit.frequency.type === 'daily' || habit.frequency.type === 'custom') {
    return index.dates.get(habit.id)?.has(day) === true
  }
  if (habit.frequency.type === 'weekly') {
    const weekKey = dateKey(weekStart(parseKey(day)))
    return (index.weekCounts.get(habit.id)?.get(weekKey) ?? 0) >= habit.frequency.times
  }
  return false
}

function dayRatioWithIndex(habits: Habit[], index: CheckInIndex, day: string): number {
  const active = habits.filter((h) => !h.archivedAt && habitActiveOnDay(h, day))
  if (active.length === 0) return -1
  const met = active.filter((h) => habitMetWithIndex(h, index, day)).length
  return met / active.length
}
/** 生成某年的年鉴模型（全部由 AppState 派生，空年份返回 hasData=false） */
export function buildYearbook(
  state: YearbookState,
  year: number,
  now: Date = new Date()
): YearbookModel {
  const live = liveCheckIns(state)
  const inYear = live.filter((c) => yearOfKey(c.date) === year)
  const habitById = new Map(state.habits.map((h) => [h.id, h] as const))
  // 索引只建一次：月度完成度 365/366 次查表，避免逐日重扫全量打卡
  const checkInIndex = buildCheckInIndex(live)

  const claimsInYear = liveDayClaims(state).filter((c) => yearOfKey(c.date) === year)
  const claimedDates = claimsInYear.map((c) => c.date)
  const claimedSet = new Set(claimedDates)

  const blocksInYear = liveBuilds(state).filter(
    (b) => yearOfKey(localDateKeyOfIso(b.placedAt)) === year
  ).length

  const buildings = buildBuildingEntries(state, year)

  const stats: YearbookStats = {
    checkIns: inYear.length,
    blocks: blocksInYear,
    completedBuildings: buildings.length,
    perfectDays: claimedSet.size,
    longestStreak: longestDayRun(claimedDates),
    focusMinutes: Math.round(
      inYear.reduce((sum, c) => {
        const minutes = typeof c.actualMinutes === 'number' ? c.actualMinutes : 0
        return Number.isFinite(minutes) && minutes > 0 ? sum + minutes : sum
      }, 0)
    ),
    notes: inYear.filter((c) => !!c.note?.trim()).length
  }

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const months: MonthBucket[] = []
  for (let month = 1; month <= 12; month++) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    const daysInMonth = new Date(year, month, 0).getDate()
    const days: YearbookDay[] = []
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${prefix}-${String(day).padStart(2, '0')}`
      days.push({
        key,
        day,
        ratio: dayRatioWithIndex(state.habits, checkInIndex, key),
        future: parseKey(key).getTime() > todayStart,
        claimed: claimedSet.has(key)
      })
    }
    months.push({
      month,
      days,
      checkIns: inYear.filter((c) => c.date.startsWith(prefix)).length
    })
  }

  return {
    year,
    stats,
    months,
    buildings,
    timeShape: buildTimeShape(inYear, habitById),
    quote: pickQuote(inYear, habitById),
    hasData: stats.checkIns > 0 || stats.blocks > 0 || stats.perfectDays > 0 || buildings.length > 0
  }
}

/** 最常时段展示：8 → "08:00"（数字格式与语言无关） */
export function formatPeakHour(hour: number | null): string {
  if (hour === null) return ''
  return `${String(hour).padStart(2, '0')}:00`
}

function focusHours(model: YearbookModel): number {
  return Math.round(model.stats.focusMinutes / 6) / 10
}

function blueprintLabel(t: TranslationSchema, blueprintId: string): string {
  return t.blueprints[blueprintId] || blueprintId
}

function habitLabel(t: TranslationSchema, name: string): string {
  return name || t.today.fullCard.deletedHabitName
}

/** ISO 星期（1=周一…7=周日）→ 本地化星期名（zh「周五」/ en「Fri」） */
function weekdayLabel(t: TranslationSchema, isoWeekday: number): string {
  return t.common.weekdayLabel(t.common.weekdaysShort[isoWeekday - 1] ?? '')
}

/** 供画布 aria-label / 读屏使用的纯文本摘要（只陈述事实） */
export function yearbookSummaryText(model: YearbookModel, t: TranslationSchema): string {
  const y = t.yearbook
  if (!model.hasData) return `${y.yearTitle(model.year)} · ${y.emptyTitle}`

  const parts = [
    y.yearTitle(model.year),
    `${y.metrics.checkIns} ${model.stats.checkIns}`,
    `${y.metrics.blocks} ${model.stats.blocks}`,
    `${y.metrics.buildings} ${model.stats.completedBuildings}`,
    `${y.metrics.allClear} ${model.stats.perfectDays}`,
    `${y.metrics.longestStreak} ${y.streakDays(model.stats.longestStreak)}`,
    `${y.metrics.focusHours} ${y.focusHoursValue(focusHours(model))}`,
    `${y.metrics.notes} ${model.stats.notes}`
  ]

  if (model.buildings.length > 0) {
    parts.push(
      `${y.sections.buildings} ${model.buildings
        .map((b) => `${blueprintLabel(t, b.blueprintId)} ${b.completedAt ?? ''}`)
        .join(' · ')}`
    )
  }

  const shape: string[] = []
  if (model.timeShape.peakWeekday !== null) {
    shape.push(`${y.busiestWeekday} ${weekdayLabel(t, model.timeShape.peakWeekday)}`)
  }
  if (model.timeShape.peakHour !== null) {
    shape.push(`${y.busiestPeriod} ${formatPeakHour(model.timeShape.peakHour)}`)
  }
  if (model.timeShape.topHabits.length > 0) {
    shape.push(
      `${y.topHabits} ${model.timeShape.topHabits
        .map((h) => `${habitLabel(t, h.name)} ${h.count}`)
        .join(' · ')}`
    )
  }
  if (shape.length > 0) parts.push(shape.join(' · '))

  if (model.quote) {
    parts.push(
      `${y.sections.quote} “${model.quote.text}” ${y.quoteFrom(habitLabel(t, model.quote.habitName))} · ${model.quote.date}`
    )
  }

  return parts.join(' · ')
}

/**
 * 独立可读的 Markdown 年鉴（不依赖本应用即可阅读）：
 * 标题、统计、建筑年表、Top 习惯、当年随笔、来源说明。
 */
export function yearbookMarkdown(
  model: YearbookModel,
  t: TranslationSchema,
  today: string = dateKey(new Date())
): string {
  const y = t.yearbook
  const lines: string[] = [`# ${y.markdownHeading(model.year)}`, '']

  if (!model.hasData) {
    lines.push(y.emptyTitle, '', y.emptyBody, '')
  } else {
    lines.push(`## ${y.sections.overview}`, '')
    lines.push(`- **${y.metrics.checkIns}**: ${model.stats.checkIns}`)
    lines.push(`- **${y.metrics.blocks}**: ${model.stats.blocks}`)
    lines.push(`- **${y.metrics.buildings}**: ${model.stats.completedBuildings}`)
    lines.push(`- **${y.metrics.allClear}**: ${model.stats.perfectDays}`)
    lines.push(`- **${y.metrics.longestStreak}**: ${y.streakDays(model.stats.longestStreak)}`)
    lines.push(`- **${y.metrics.focusHours}**: ${y.focusHoursValue(focusHours(model))}`)
    lines.push(`- **${y.metrics.notes}**: ${model.stats.notes}`)
    lines.push('')

    lines.push(`## ${y.sections.buildings}`, '')
    if (model.buildings.length === 0) {
      lines.push(`- ${y.noData}`)
    } else {
      for (const building of model.buildings) {
        const name = blueprintLabel(t, building.blueprintId)
        const date = building.completedAt ?? ''
        lines.push(`- **${name}** — ${y.buildingDate(date)}`)
        if (building.foundationNote) lines.push(`  > “${building.foundationNote}”`)
      }
    }
    lines.push('')

    lines.push(`## ${y.sections.shape}`, '')
    const weekday =
      model.timeShape.peakWeekday !== null ? weekdayLabel(t, model.timeShape.peakWeekday) : y.noData
    const period =
      model.timeShape.peakHour !== null ? formatPeakHour(model.timeShape.peakHour) : y.noData
    lines.push(`- **${y.busiestWeekday}**: ${weekday}`)
    lines.push(`- **${y.busiestPeriod}**: ${period}`)
    if (model.timeShape.topHabits.length === 0) {
      lines.push(`- **${y.topHabits}**: ${y.noData}`)
    } else {
      model.timeShape.topHabits.forEach((habit, index) => {
        lines.push(
          `- **${y.topHabits} ${index + 1}**: ${habitLabel(t, habit.name)} · ${habit.count}`
        )
      })
    }
    lines.push('')

    lines.push(`## ${y.sections.quote}`, '')
    if (model.quote) {
      lines.push(
        `> “${model.quote.text}”`,
        `>`,
        `> ${y.quoteFrom(habitLabel(t, model.quote.habitName))} · ${model.quote.date}`,
        ''
      )
    } else {
      lines.push(`- ${y.noData}`, '')
    }
  }

  lines.push('---', '')
  lines.push(
    `*${t.stats.exportTitle} · ${t.stats.exportDate}: ${today} · ${y.coverTitle} · ${y.yearTitle(model.year)}*`
  )
  return lines.join('\n')
}
