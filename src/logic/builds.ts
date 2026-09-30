import type { CheckIn, DayClaim, PlacedBlock } from '../types'

/**
 * 积木层是打卡与全勤事实的确定性投影：
 * - 普通块来自带 placedBlockId + blueprintId 的有效打卡（bonus: false）；
 * - 全勤块来自每条 DayClaim（bonus: true，fromHabitId '__day__'）；
 * - 每个蓝图内按 placedAt（全勤块用 claimedAt）升序、id 决胜排序，index = 组内序号（天然 0..N-1 连续）。
 *
 * 同步合并 / 导入后统一调用重建，保证多端投影一致；
 * 日常 checkIn / checkInDay 仍走增量 append（性能路径），uncheckIn 后重建以完成压实。
 */
export function rebuildBuilds(liveCheckIns: CheckIn[], claims: DayClaim[]): PlacedBlock[] {
  type Fact = { id: string; blueprintId: string; placedAt: string; fromHabitId: string; bonus: boolean }

  const facts: Fact[] = []
  for (const c of liveCheckIns) {
    if (c.deletedAt) continue
    if (!c.placedBlockId || !c.blueprintId) continue
    facts.push({
      id: c.placedBlockId,
      blueprintId: c.blueprintId,
      placedAt: c.at,
      fromHabitId: c.habitId,
      bonus: false,
    })
  }
  for (const claim of claims) {
    if (!claim.blockId || !claim.blueprintId) continue
    facts.push({
      id: claim.blockId,
      blueprintId: claim.blueprintId,
      placedAt: claim.claimedAt,
      fromHabitId: '__day__',
      bonus: true,
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
    group.forEach((f, index) => {
      builds.push({
        id: f.id,
        blueprintId,
        index,
        placedAt: f.placedAt,
        fromHabitId: f.fromHabitId,
        bonus: f.bonus,
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
