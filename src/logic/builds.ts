import type { CheckIn, DayClaim, PlacedBlock } from '../types'
import { blueprints } from './blueprints'

/**
 * 积木层是打卡与全勤事实的确定性投影：
 * - 普通块来自带 placedBlockId + blueprintId 的有效打卡（bonus: false）；
 * - 全勤块来自每条 DayClaim（bonus: true，fromHabitId '__day__'）；
 * - 每个蓝图内按 placedAt（全勤块用 claimedAt）升序、id 决胜排序，index = 组内序号（天然 0..N-1 连续）。
 *
 * 同步合并 / 导入后统一调用重建，保证多端投影一致；
 * 日常 checkIn / checkInDay 仍走增量 append（性能路径），uncheckIn 后重建以完成压实。
 */
/** 蓝图容量表：每个蓝图可容纳的块数。投影时用它钳制越界块（多端离线各自建满后合并会超出） */
export const BLUEPRINT_CAPACITY: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(Object.entries(blueprints).map(([id, bp]) => [id, bp.blocks.length]))
)

export function rebuildBuilds(
  liveCheckIns: CheckIn[],
  claims: DayClaim[],
  capacities: Record<string, number> = BLUEPRINT_CAPACITY
): PlacedBlock[] {
  type Fact = {
    id: string
    blueprintId: string
    placedAt: string
    fromHabitId: string
    bonus: boolean
  }

  const facts: Fact[] = []
  for (const c of liveCheckIns) {
    if (c.deletedAt) continue
    if (!c.placedBlockId || !c.blueprintId) continue
    facts.push({
      id: c.placedBlockId,
      blueprintId: c.blueprintId,
      placedAt: c.at,
      fromHabitId: c.habitId,
      bonus: c.bonus === true
    })
  }
  for (const claim of claims) {
    if (!claim.blockId || !claim.blueprintId) continue
    facts.push({
      id: claim.blockId,
      blueprintId: claim.blueprintId,
      placedAt: claim.claimedAt,
      fromHabitId: '__day__',
      bonus: true
    })
  }

  const byBlueprint = new Map<string, Fact[]>()
  for (const f of facts) {
    const group = byBlueprint.get(f.blueprintId)
    if (group) group.push(f)
    else byBlueprint.set(f.blueprintId, [f])
  }

  const builds: PlacedBlock[] = []
  for (const [blueprintId, group] of byBlueprint) {
    group.sort((a, b) => a.placedAt.localeCompare(b.placedAt) || a.id.localeCompare(b.id))
    // 容量钳制：超出蓝图块数的多余事实不再投影（保留事实层数据，不删打卡）
    const capacity = capacities[blueprintId] ?? group.length
    group.slice(0, Math.max(0, capacity)).forEach((f, index) => {
      builds.push({
        id: f.id,
        blueprintId,
        index,
        placedAt: f.placedAt,
        fromHabitId: f.fromHabitId,
        bonus: f.bonus
      })
    })
  }
  // 蓝图间按 id 排序保证输出稳定
  builds.sort((a, b) => a.blueprintId.localeCompare(b.blueprintId) || a.index - b.index)
  return builds
}

/** 有效（未墓碑化）打卡视图：store/UI 消费方统一过滤入口 */
export function liveCheckInsView(checkIns: CheckIn[]): CheckIn[] {
  return checkIns.filter((c) => !c.deletedAt)
}

/**
 * 当前 builds 是否已经是事实的等价投影（只比 id + 蓝图，不比 index 顺序）。
 * 用于决定「能否安全重建」：若存档来自旧版本、存在无法由事实推导的块，重建会丢数据。
 */
export function buildsMatchFacts(
  builds: PlacedBlock[],
  liveCheckIns: CheckIn[],
  claims: DayClaim[],
  capacities: Record<string, number> = BLUEPRINT_CAPACITY
): boolean {
  const expected = rebuildBuilds(liveCheckIns, claims, capacities)
  if (expected.length !== builds.length) return false
  const actual = new Map(builds.map((b) => [b.id, b.blueprintId]))
  for (const e of expected) {
    if (actual.get(e.id) !== e.blueprintId) return false
  }
  return true
}

/**
 * 保守移除：只删指定块并把同蓝图内的 index 压实，其余块原样保留。
 * 用于「builds 与事实不一致（旧档 / 外部导入）」时撤销打卡：
 * 全量重建会把无法由事实推导的块抹掉，这里宁可不重建。
 */
export function removeBlocksAndCompact(
  builds: PlacedBlock[],
  removedIds: ReadonlySet<string>
): PlacedBlock[] {
  const kept = builds.filter((b) => !removedIds.has(b.id))
  const byBlueprint = new Map<string, PlacedBlock[]>()
  for (const b of kept) {
    const group = byBlueprint.get(b.blueprintId)
    if (group) group.push(b)
    else byBlueprint.set(b.blueprintId, [b])
  }
  const out: PlacedBlock[] = []
  for (const group of byBlueprint.values()) {
    group.sort(
      (a, b) =>
        a.index - b.index || a.placedAt.localeCompare(b.placedAt) || a.id.localeCompare(b.id)
    )
    group.forEach((b, index) => out.push({ ...b, index }))
  }
  out.sort((a, b) => a.blueprintId.localeCompare(b.blueprintId) || a.index - b.index)
  return out
}
