import type { AppState, CheckIn, DayClaim, Habit, ReminderLogEntry } from '../types'
import { blueprints } from '../logic/blueprints'
import { CONTENT_VERSION } from '../logic/blueprints/manifest'
import { rebuildBuilds, liveCheckInsView, BLUEPRINT_CAPACITY } from '../logic/builds'

/** 安全获取蓝图总块数（未知/畸形 id 返回 null，不抛异常） */
function blueprintBlockCount(id: string): number | null {
  const bp = blueprints[id]
  return bp ? bp.blocks.length : null
}

/**
 * 同步合并原则（schema v2）：
 * - 只对「事实层」合并：习惯（LWW）、打卡（id 合并 + 删除墓碑）、全勤领取（按日 LWW + 墓碑）；
 * - 积木层是事实的确定性投影：合并完成后由 rebuildBuilds 重建，index 天然压实且多端一致；
 * - 设置为全字段并集（本地优先），低冲突可接受。
 */

/** 新者胜：updatedAt 缺失的一方视为旧（兼容旧档，保持本地优先的旧行为） */
function isNewerHabit(local: Habit, remote: Habit): boolean {
  if (local.updatedAt && remote.updatedAt) {
    if (local.updatedAt !== remote.updatedAt) return local.updatedAt > remote.updatedAt
    return true // 同刻本地胜
  }
  if (local.updatedAt) return true
  if (remote.updatedAt) return false
  return true
}

/**
 * Merges habits by id with updatedAt LWW (newest edit wins, including archive/restore/pin).
 * Habits without updatedAt (legacy archives) fall back to local-priority spread.
 */
/**
 * custom 习惯 days 为空时钳制为工作日并保留习惯（而非静默丢弃）：
 * 坏档通常源于旧版本客户端或中断写入，同步应是"尽力修复"而非"无声消失"。
 */
function clampHabit(h: Habit): Habit {
  if (!h || !h.id) return h
  if (
    h.frequency?.type === 'custom' &&
    (!Array.isArray(h.frequency.days) || h.frequency.days.length === 0)
  ) {
    return { ...h, frequency: { type: 'custom', days: [1, 2, 3, 4, 5] } }
  }
  return h
}

function mergeHabits(localHabits: Habit[], remoteHabits: Habit[]): Habit[] {
  const habitMap = new Map<string, Habit>()
  for (const h of remoteHabits || []) {
    if (h && h.id) {
      // 不再用 isValidHabit 静默丢弃：空 days 由 clampHabit 钳制修复
      habitMap.set(h.id, { ...clampHabit(h) })
    }
  }
  for (const h of localHabits || []) {
    if (!h || !h.id) continue
    const existing = habitMap.get(h.id)
    if (!existing) {
      habitMap.set(h.id, { ...clampHabit(h) })
    } else {
      habitMap.set(h.id, isNewerHabit(h, existing) ? { ...clampHabit(h) } : existing)
    }
  }
  return Array.from(habitMap.values())
}

/**
 * Merges check-ins by id (counter habits) or habitId+date (others), with deletion tombstones:
 * any side carrying deletedAt wins — an undo on one device must not be resurrected by the other.
 * Enriches surviving check-ins by merging metadata (notes, mood, starred).
 */
function mergeCheckIns(
  localCheckIns: CheckIn[],
  remoteCheckIns: CheckIn[],
  habits: Habit[] = [],
): CheckIn[] {
  const merged: CheckIn[] = []
  const idMap = new Map<string, number>()
  const dayMap = new Map<string, number>()
  const habitMap = new Map<string, Habit>(habits.map((h) => [h.id, h]))

  function addOrMerge(c: CheckIn, isRemote: boolean) {
    const habit = habitMap.get(c.habitId)
    const isCounter = habit?.kind === 'counter'
    const dayKey = `${c.habitId}_${c.date}`
    let existingIndex: number | undefined

    if (c.id && idMap.has(c.id)) {
      existingIndex = idMap.get(c.id)
    } else if (!isCounter && dayMap.has(dayKey)) {
      existingIndex = dayMap.get(dayKey)
    }

    if (existingIndex !== undefined) {
      const existing = merged[existingIndex]
      const base = isRemote ? existing : c
      const other = isRemote ? c : existing

      const combined: CheckIn = {
        ...other,
        ...base,
        note: (base.note && base.note.trim()) ? base.note : other.note,
        mood: base.mood || other.mood,
        starred: Boolean(base.starred || other.starred),
        placedBlockId: base.placedBlockId || other.placedBlockId,
        blueprintId: base.blueprintId || other.blueprintId,
        actualMinutes: base.actualMinutes ?? other.actualMinutes,
        value: base.value ?? other.value,
        bonus: base.bonus ?? other.bonus,
        // 墓碑一旦出现即生效（不可逆），任一侧携带即保留
        deletedAt: base.deletedAt ?? other.deletedAt,
      }
      merged[existingIndex] = combined
      if (c.id) idMap.set(c.id, existingIndex)
    } else {
      const newIdx = merged.length
      merged.push({ ...c })
      if (c.id) idMap.set(c.id, newIdx)
      if (!isCounter) dayMap.set(dayKey, newIdx)
    }
  }

  for (const c of remoteCheckIns || []) {
    addOrMerge(c, true)
  }
  for (const c of localCheckIns || []) {
    addOrMerge(c, false)
  }

  return merged.sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at))
}

/**
 * Merges day claims per date with timestamp LWW:
 * the later of (claimedAt, deletedAt) decides whether the day is claimed —
 * supports repeated claim / unclaim of the same day converging across devices.
 */
function mergeDayClaims(
  localClaims: DayClaim[],
  remoteClaims: DayClaim[],
  localDeleted: { date: string; deletedAt: string }[],
  remoteDeleted: { date: string; deletedAt: string }[],
): { claims: DayClaim[]; deleted: { date: string; deletedAt: string }[] } {
  const claimByDate = new Map<string, DayClaim>()
  for (const c of remoteClaims || []) {
    if (!claimByDate.has(c.date)) claimByDate.set(c.date, { ...c })
  }
  for (const c of localClaims || []) {
    const existing = claimByDate.get(c.date)
    if (!existing) {
      claimByDate.set(c.date, { ...c })
    } else if (c.claimedAt > existing.claimedAt) {
      claimByDate.set(c.date, { ...c })
    } else if (c.claimedAt === existing.claimedAt) {
      // 同刻：合并双方字段，blockId/blueprintId 取非空者
      claimByDate.set(c.date, {
        date: c.date,
        claimedAt: c.claimedAt,
        blockId: c.blockId || existing.blockId,
        blueprintId: c.blueprintId || existing.blueprintId,
      })
    }
  }

  const deletedByDate = new Map<string, string>()
  for (const d of remoteDeleted || []) {
    if (!deletedByDate.has(d.date) || d.deletedAt > deletedByDate.get(d.date)!) {
      deletedByDate.set(d.date, d.deletedAt)
    }
  }
  for (const d of localDeleted || []) {
    if (!deletedByDate.has(d.date) || d.deletedAt > deletedByDate.get(d.date)!) {
      deletedByDate.set(d.date, d.deletedAt)
    }
  }

  const claims: DayClaim[] = []
  for (const c of claimByDate.values()) {
    const deletedAt = deletedByDate.get(c.date)
    if (deletedAt && deletedAt >= c.claimedAt) continue // 撤销晚于领取：该日未领取
    claims.push(c)
  }
  // 已被更晚的重新领取覆盖的墓碑不再需要保留
  const deleted: { date: string; deletedAt: string }[] = []
  for (const [date, deletedAt] of deletedByDate) {
    const c = claimByDate.get(date)
    if (c && c.claimedAt > deletedAt) continue
    deleted.push({ date, deletedAt })
  }
  return { claims, deleted }
}

/**
 * CRDT merge between local and remote AppState (schema v2).
 * Facts are merged; the block layer is rebuilt deterministically from merged facts,
 * guaranteeing identical projections (compact 0..N-1 indices) on every device.
 */
export function mergeAppState(local: AppState, remote: AppState): AppState {
  const habits = mergeHabits(local.habits, remote.habits)
  const checkIns = mergeCheckIns(local.checkIns, remote.checkIns, habits)
  const { claims: dayClaims, deleted: deletedDayClaims } = mergeDayClaims(
    local.dayClaims || [],
    remote.dayClaims || [],
    local.deletedDayClaims || [],
    remote.deletedDayClaims || [],
  )

  // 墓碑 GC：清理超过 90 天的删除墓碑，防止存档无限膨胀
  // （已知限制：离线超过 90 天的设备参与合并时，对应删除可能复活一次）
  const gcCutoff = Date.now() - 90 * 86_400_000
  const gcCheckIns = checkIns.filter(
    (c) => !c.deletedAt || new Date(c.deletedAt).getTime() >= gcCutoff,
  )
  const gcDeletedClaims = deletedDayClaims.filter(
    (d) => new Date(d.deletedAt).getTime() >= gcCutoff,
  )

  // 积木层 = 事实投影（合并后重建，不再按 index 并集）
  const builds = rebuildBuilds(liveCheckInsView(gcCheckIns), dayClaims, BLUEPRINT_CAPACITY)

  const repairBricks = Math.max(local.repairBricks ?? 0, remote.repairBricks ?? 0)
  // 月份键取较晚的一个：谁的月额度结算更近，以谁为准（同月则相同）
  const repairBrickMonth = [local.repairBrickMonth, remote.repairBrickMonth]
    .filter((m): m is string => typeof m === 'string')
    .sort()
    .pop()

  const foundationNotes: Record<string, string> = {
    ...(remote.foundationNotes || {}),
    ...(local.foundationNotes || {}),
  }

  const placementMap = new Map<string, { blueprintId: string; gridX: number; gridY: number }>()
  for (const p of remote.showcasePlacements || []) placementMap.set(p.blueprintId, { ...p })
  for (const p of local.showcasePlacements || []) placementMap.set(p.blueprintId, { ...p })
  const showcasePlacements = Array.from(placementMap.values())

  // 提醒处置（跳过今天）：按 habit 保留日期更新的一方（记录本身按天覆盖，取新即最新决策）
  const reminderLog: Record<string, ReminderLogEntry> = {}
  const reminderLogIds = new Set([
    ...Object.keys(local.reminderLog || {}),
    ...Object.keys(remote.reminderLog || {}),
  ])
  for (const id of reminderLogIds) {
    const l = local.reminderLog?.[id]
    const r = remote.reminderLog?.[id]
    if (l && r) reminderLog[id] = l.date >= r.date ? l : r
    else if (l) reminderLog[id] = l
    else if (r) reminderLog[id] = r
  }

  // 设置全字段并集（本地优先，缺字段回退远端）
  const settings = {
    ...(remote.settings || {}),
    ...(local.settings || {}),
  }

  const activeBlueprintId = local.activeBlueprintId || remote.activeBlueprintId || 'plant'

  // 完成态对账：完成列表取双方并集，但撤销可能让蓝图退回未完成——
  // 重建投影后块数不足者剔除。展台摆放随之对账：无法判定完成态的（真实数据中不存在）保守保留。
  const completedSet = new Set([
    ...(local.completedBlueprintIds || []),
    ...(remote.completedBlueprintIds || []),
  ])
  const activeCompleted = Array.from(completedSet).filter((id) => {
    const total = blueprintBlockCount(id)
    return total !== null && rebuildCountForBlueprint(builds, id) >= total
  }).sort()
  const showcasePlacementsFiltered = showcasePlacements.filter((p) => {
    if (!completedSet.has(p.blueprintId)) return true
    const total = blueprintBlockCount(p.blueprintId)
    if (total === null) return true
    return rebuildCountForBlueprint(builds, p.blueprintId) >= total
  })

  return {
    schemaVersion: 2,
    // 内容版本取双方较高值：旧端与高内容端合并后不能把版本写低（门禁在读取前）
    // 至少为当前内容版本：合并结果可能被本安装包继续产出 v2 建筑，不能写低
    contentVersion: Math.max(
      CONTENT_VERSION,
      local.contentVersion ?? CONTENT_VERSION,
      remote.contentVersion ?? CONTENT_VERSION,
    ),
    habits,
    checkIns: gcCheckIns,
    builds,
    activeBlueprintId,
    completedBlueprintIds: activeCompleted,
    settings: settings as AppState['settings'],
    dayClaims,
    deletedDayClaims: gcDeletedClaims,
    repairBricks,
    repairBrickMonth,
    showcasePlacements: showcasePlacementsFiltered,
    foundationNotes,
    reminderLog,
  }
}

function rebuildCountForBlueprint(builds: AppState['builds'], blueprintId: string): number {
  return builds.filter((b) => b.blueprintId === blueprintId).length
}
