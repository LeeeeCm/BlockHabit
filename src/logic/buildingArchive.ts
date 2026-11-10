import type { AppState, CheckIn, Habit, MicroMood, PlacedBlock } from '../types'
import { blueprints, blueprintOrder } from './blueprints'
import { dateKey } from './dates'

/**
 * 建筑档案（B3 / D-20261110-065）纯逻辑层。
 *
 * 全部数据从现有 AppState 派生，零新字段：
 * - 落成日 = 该蓝图块数达到蓝图容量时 max(placedAt) 的本地日期（completedBlueprintIds 顺序不可信：
 *   sync/merge 会按 id 排序，只作「曾完成」标记，用于判定「落成时间不可考」）；
 * - 投入最多习惯 = builds.fromHabitId 计数（排除全勤块 '__day__'）；
 * - 关键块 = 已落成蓝图按块序位的 首块 / 25% / 50% / 75% / 末块（index 已在 rebuildBuilds 中保证连续）；
 * - 随笔 = checkIns.placedBlockId 反查到本建筑的块（排除墓碑）；
 * - 铭言 = foundationNotes[blueprintId]（编辑由 store 负责，本模块只读）。
 *
 * 时间口径：builds.placedAt 是 ISO UTC，统一先转本地 dateKey；checkIns.date 已是本地日期键。
 */

/** buildBuildingArchive 需要的 AppState 切片（AppState 可直接传入） */
export type BuildingArchiveState = Pick<
  AppState,
  'builds' | 'checkIns' | 'habits' | 'foundationNotes' | 'completedBlueprintIds'
>

/** 块序号 → 打卡事实元数据（与 render/BuildScene 的 blockMetaByIndex 同源同算法） */
export interface ArchiveBlockMeta {
  pb: PlacedBlock
  ci?: CheckIn
  habitName?: string
}

export type MilestoneKind = 'first' | 'percent' | 'last'

export interface ArchiveMilestone {
  /** 蓝图内块序位（0 基） */
  index: number
  kind: MilestoneKind
  /** 中间锚点的百分比（25 / 50 / 75）；首末块为 undefined */
  percent?: number
  /** 本地日期键；时间戳非法时为空串 */
  date: string
  blockId: string
  fromHabitId: string
  habitId: string
  /** 习惯名；全勤/奖励块等无打卡关联时为空串（展示层回退） */
  habitName: string
  bonus: boolean
  note?: string
  mood?: MicroMood
  starred?: boolean
  checkInId?: string
}

export interface ArchiveTopHabit {
  habitId: string
  name: string
  count: number
}

export interface ArchiveNoteEntry {
  checkInId: string
  index: number
  date: string
  habitId: string
  habitName: string
  note: string
  mood?: MicroMood
  starred?: boolean
}

export interface BuildingArchive {
  blueprintId: string
  /** 是否已落成（块数 ≥ 蓝图容量） */
  completed: boolean
  /** 落成日（本地日期键）；未落成或时间戳损坏时为 null */
  completedAt: string | null
  /** 首块落下日（本地日期键） */
  firstPlacedAt: string | null
  /** 首块 → 落成 的日历天数（只算首尾差，同日为 0；时间不可考时为 null） */
  days: number | null
  /** 已放置块数（落成时 = 蓝图容量） */
  totalBlocks: number
  /** 奖励块数（bonus=true，含全勤奖励块） */
  bonusBlocks: number
  /** 块序位 → 是否奖励块（画布给已完成模型描边用；索引与蓝图数组一致） */
  bonusByIndex: boolean[]
  /** 全勤贡献块数（fromHabitId='__day__'，一天一块） */
  dayClaimBlocks: number
  /** 投入最多的习惯（排好序，最多 3 个） */
  topHabits: ArchiveTopHabit[]
  /** 投入最多的那一个（并列时取习惯创建更早者） */
  topHabit: ArchiveTopHabit | null
  /** 关键块（首 / 25% / 50% / 75% / 末，按块序位升序去重） */
  milestones: ArchiveMilestone[]
  /** 本建筑的随笔（按日期升序，已排除墓碑与空随笔） */
  notes: ArchiveNoteEntry[]
  foundationNote?: string
  /** completedBlueprintIds 里有它但块数不足（旧档/撤销）：落成时间不可考 */
  archivedAtUnknown: boolean
  /** 第 N 座（按落成时间升序的序号，1 基）；未落成为 null */
  ordinal: number | null
  /** 已落成建筑总数 */
  totalCompleted: number
}

const DAY_MS = 86_400_000

function isValidIso(iso: string | undefined | null): boolean {
  return typeof iso === 'string' && iso.length > 0 && Number.isFinite(Date.parse(iso))
}

/** ISO UTC → 本地日期键；非法返回 null */
function localDateKeyOfIso(iso: string | undefined | null): string | null {
  if (!isValidIso(iso)) return null
  return dateKey(new Date(Date.parse(iso as string)))
}

/** 两个本地日期键的日历天数差（UTC 归一，避免夏令时） */
function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / DAY_MS)
}

function liveBlocksOf(state: BuildingArchiveState, blueprintId: string): PlacedBlock[] {
  return state.builds.filter((b) => b.blueprintId === blueprintId && !b.deletedAt)
}

function capitalOf(blueprintId: string): number | null {
  const blueprint = blueprints[blueprintId]
  return blueprint ? blueprint.blocks.length : null
}

/** 该蓝图落成时间戳（ms）：块数达容量时取 max(placedAt)；未落成/时间戳非法 → null */
function completionMsOf(state: BuildingArchiveState, blueprintId: string): number | null {
  const capacity = capitalOf(blueprintId)
  if (capacity === null) return null
  const blocks = liveBlocksOf(state, blueprintId)
  if (blocks.length < capacity) return null
  let max = -Infinity
  for (const block of blocks) {
    if (!isValidIso(block.placedAt)) continue
    max = Math.max(max, Date.parse(block.placedAt))
  }
  return max === -Infinity ? null : max
}

/**
 * 该蓝图的落成日（本地日期键）。
 * 与 A2 的 logic/yearbook.ts completionDateOf 同口径（本模块只需 AppState 切片，因此单独实现；
 * 两者由单测交叉校验，避免口径漂移）。
 */
export function completionDateOf(state: BuildingArchiveState, blueprintId: string): string | null {
  const ms = completionMsOf(state, blueprintId)
  return ms === null ? null : dateKey(new Date(ms))
}

/** 已落成建筑（按落成时间倒序；同刻按蓝图顺序稳定） */
export function listArchiveBuildings(state: BuildingArchiveState): string[] {
  const orderIndex = new Map(blueprintOrder.map((id, index) => [id, index] as const))
  const completed: Array<{ id: string; ms: number }> = []
  for (const id of blueprintOrder) {
    const ms = completionMsOf(state, id)
    if (ms !== null) completed.push({ id, ms })
  }
  completed.sort(
    (a, b) => b.ms - a.ms || (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0),
  )
  return completed.map((entry) => entry.id)
}

/**
 * 块序号 → 打卡事实元数据（O(1)）：与 render/BuildScene 的 blockMetaByIndex 同源实现。
 * 若两处口径不一致，悬停气泡与档案卡会对同一天给出不同说法。
 */
export function blockMetaIndex(
  state: BuildingArchiveState,
  blueprintId: string,
): Map<number, ArchiveBlockMeta> {
  const index = new Map<number, ArchiveBlockMeta>()
  const ciByPlacedBlockId = new Map<string, CheckIn>()
  for (const ci of state.checkIns) {
    if (ci.placedBlockId && !ci.deletedAt) ciByPlacedBlockId.set(ci.placedBlockId, ci)
  }
  const habitMap = new Map<string, string>(state.habits.map((h) => [h.id, h.name] as const))
  for (const pb of state.builds) {
    if (pb.blueprintId !== blueprintId || pb.deletedAt) continue
    const ci = ciByPlacedBlockId.get(pb.id)
    index.set(pb.index, { pb, ci, habitName: ci ? habitMap.get(ci.habitId) : undefined })
  }
  return index
}

/** 关键块锚点：首块 / 25% / 50% / 75% / 末块，按块序位去重升序 */
function milestoneAnchors(capacity: number): Array<{ index: number; kind: MilestoneKind; percent?: number }> {
  if (capacity <= 0) return []
  const fractions = [0, 0.25, 0.5, 0.75, 1]
  const picked = new Map<number, number>()
  for (const fraction of fractions) {
    const index = Math.round((capacity - 1) * fraction)
    if (!picked.has(index)) picked.set(index, Math.round(fraction * 100))
  }
  return [...picked.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, percent]) => ({
      index,
      kind: index === 0 ? 'first' : index === capacity - 1 ? 'last' : 'percent',
      percent: index === 0 || index === capacity - 1 ? undefined : percent,
    }))
}

function buildMilestones(
  state: BuildingArchiveState,
  blueprintId: string,
  capacity: number,
): ArchiveMilestone[] {
  const meta = blockMetaIndex(state, blueprintId)
  return milestoneAnchors(capacity).map((anchor) => {
    const entry = meta.get(anchor.index)
    const ci = entry?.ci
    const pb = entry?.pb
    const date = localDateKeyOfIso(pb?.placedAt) ?? ''
    return {
      index: anchor.index,
      kind: anchor.kind,
      percent: anchor.percent,
      date,
      blockId: pb?.id ?? '',
      fromHabitId: pb?.fromHabitId ?? '',
      habitId: ci?.habitId ?? '',
      habitName: entry?.habitName ?? '',
      bonus: pb?.bonus === true,
      note: ci?.note?.trim() ? ci.note.trim() : undefined,
      mood: ci?.mood,
      starred: ci?.starred === true,
      checkInId: ci?.id,
    }
  })
}

function buildNotes(
  state: BuildingArchiveState,
  blueprintId: string,
): ArchiveNoteEntry[] {
  const indexByBlockId = new Map<string, number>()
  for (const pb of state.builds) {
    if (pb.blueprintId === blueprintId && !pb.deletedAt) indexByBlockId.set(pb.id, pb.index)
  }
  const habitMap = new Map<string, string>(state.habits.map((h) => [h.id, h.name] as const))
  const notes: ArchiveNoteEntry[] = []
  for (const ci of state.checkIns) {
    if (ci.deletedAt) continue
    if (!ci.placedBlockId || !indexByBlockId.has(ci.placedBlockId)) continue
    const text = ci.note?.trim()
    if (!text) continue
    notes.push({
      checkInId: ci.id,
      index: indexByBlockId.get(ci.placedBlockId) as number,
      date: ci.date,
      habitId: ci.habitId,
      habitName: habitMap.get(ci.habitId) ?? '',
      note: text,
      mood: ci.mood,
      starred: ci.starred === true,
    })
  }
  notes.sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index || a.checkInId.localeCompare(b.checkInId))
  return notes
}

function buildTopHabits(state: BuildingArchiveState, blocks: PlacedBlock[]): ArchiveTopHabit[] {
  const habitMap = new Map<string, Habit>(state.habits.map((h) => [h.id, h] as const))
  const counts = new Map<string, number>()
  for (const block of blocks) {
    if (block.fromHabitId === '__day__') continue
    counts.set(block.fromHabitId, (counts.get(block.fromHabitId) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([habitId, count]) => ({
      habitId,
      name: habitMap.get(habitId)?.name ?? '',
      count,
      createdAt: habitMap.get(habitId)?.createdAt ?? '',
    }))
    .sort(
      (a, b) =>
        b.count - a.count || a.createdAt.localeCompare(b.createdAt) || a.habitId.localeCompare(b.habitId),
    )
    .slice(0, 3)
    .map(({ habitId, name, count }) => ({ habitId, name, count }))
}

/**
 * 生成某座建筑的档案（全部由 AppState 派生）。
 * 未落成 / 未知蓝图 / 时间戳损坏 → completed=false（archivedAtUnknown 标记「曾完成但时间不可考」）。
 */
export function buildBuildingArchive(
  state: BuildingArchiveState,
  blueprintId: string,
): BuildingArchive {
  const blueprint = blueprints[blueprintId]
  const capacity = blueprint ? blueprint.blocks.length : 0
  const blocks = liveBlocksOf(state, blueprintId)
  const completed = blueprint !== undefined && blocks.length >= capacity && capacity > 0
  const completionMs = completed ? completionMsOf(state, blueprintId) : null
  const completedAt = completionMs === null ? null : dateKey(new Date(completionMs))
  const firstPlacedAt = completed
    ? blocks
        .map((block) => localDateKeyOfIso(block.placedAt))
        .filter((key): key is string => key !== null)
        .sort()[0] ?? null
    : blocks.length > 0
      ? blocks
          .map((block) => localDateKeyOfIso(block.placedAt))
          .filter((key): key is string => key !== null)
          .sort()[0] ?? null
      : null
  const days =
    completed && completedAt && firstPlacedAt ? Math.max(0, dayDiff(completedAt, firstPlacedAt)) : null

  const completedAsc = [...blueprintOrder]
    .map((id) => ({ id, ms: completionMsOf(state, id) }))
    .filter((entry): entry is { id: string; ms: number } => entry.ms !== null)
    .sort((a, b) => a.ms - b.ms || blueprintOrder.indexOf(a.id) - blueprintOrder.indexOf(b.id))
  const ordinalIndex = completedAsc.findIndex((entry) => entry.id === blueprintId)

  const topHabits = buildTopHabits(state, blocks)
  const archive: BuildingArchive = {
    blueprintId,
    completed,
    completedAt,
    firstPlacedAt,
    days,
    totalBlocks: blocks.length,
    bonusBlocks: blocks.filter((block) => block.bonus === true).length,
    bonusByIndex: blocks.reduce<boolean[]>((list, block) => {
      list[block.index] = block.bonus === true
      return list
    }, []),
    dayClaimBlocks: blocks.filter((block) => block.fromHabitId === '__day__').length,
    topHabits,
    topHabit: topHabits[0] ?? null,
    milestones: completed ? buildMilestones(state, blueprintId, capacity) : [],
    notes: completed ? buildNotes(state, blueprintId) : [],
    foundationNote: state.foundationNotes?.[blueprintId]?.trim() || undefined,
    archivedAtUnknown:
      !completed && (state.completedBlueprintIds ?? []).includes(blueprintId),
    ordinal: ordinalIndex >= 0 ? ordinalIndex + 1 : null,
    totalCompleted: completedAsc.length,
  }
  return archive
}
