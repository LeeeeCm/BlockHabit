import type {
  AppState,
  CheckIn,
  DayClaim,
  DeletedHabit,
  Habit,
  ReminderLogEntry,
  ShowcasePlacement,
  ShowcaseSandbox
} from '../types'
import { blueprints } from '../logic/blueprints'
import { CONTENT_VERSION } from '../logic/blueprints/manifest'
import { rebuildBuilds, liveCheckInsView, BLUEPRINT_CAPACITY } from '../logic/builds'
import { SHOWCASE_SANDBOX_MAX } from '../logic/showcase'
import { resolveShowcaseState } from '../logic/showcaseState'

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

/** 习惯删除墓碑合并：同一 id 保留最新删除时间；删除一旦发生即胜出，防止远端旧存档复活 */
function mergeDeletedHabits(
  local: DeletedHabit[] | undefined,
  remote: DeletedHabit[] | undefined
): DeletedHabit[] {
  const byId = new Map<string, DeletedHabit>()
  for (const entry of [...(remote ?? []), ...(local ?? [])]) {
    if (!entry || typeof entry.id !== 'string' || !entry.id) continue
    if (typeof entry.deletedAt !== 'string' || !entry.deletedAt) continue
    const existing = byId.get(entry.id)
    if (!existing || entry.deletedAt > existing.deletedAt) {
      byId.set(entry.id, { id: entry.id, deletedAt: entry.deletedAt })
    }
  }
  return [...byId.values()]
}

/**
 * Merges check-ins by id (counter habits) or habitId+date (others), with deletion tombstones:
 * the later of the live check-in's `at` and the tombstone's `deletedAt` wins, so an undo cannot
 * be resurrected by an older archive, while a deliberate re-check-in after undo survives sync.
 * Enriches surviving live check-ins by merging metadata (notes, mood, starred).
 */
function mergeCheckIns(
  localCheckIns: CheckIn[],
  remoteCheckIns: CheckIn[],
  habits: Habit[] = []
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
      const existingDeleted = Boolean(existing.deletedAt)
      const incomingDeleted = Boolean(c.deletedAt)
      let combined: CheckIn

      if (existingDeleted !== incomingDeleted) {
        // D-20261128-133：墓碑与重新打卡不能无条件让墓碑胜出。
        // 比较“最后一次事件”的时间：打卡看 at，撤销看 deletedAt；更晚发生的一方胜出。
        // 旧实现 deletedAt 任一非空即胜出，会把撤销后同日重新打卡的 live 记录吞掉。
        const existingEvent = existing.deletedAt ?? existing.at
        const incomingEvent = c.deletedAt ?? c.at
        const winner = incomingEvent > existingEvent ? c : existing
        combined = { ...winner, deletedAt: winner.deletedAt }
      } else if (existingDeleted && incomingDeleted) {
        // 两边都是墓碑：保留更晚的撤销时间
        const winner = (c.deletedAt ?? '') > (existing.deletedAt ?? '') ? c : existing
        combined = { ...winner }
      } else {
        // 两边都是 live：沿用原有的本地优先 + 元数据并集
        const base = isRemote ? existing : c
        const other = isRemote ? c : existing
        combined = {
          ...other,
          ...base,
          note: base.note && base.note.trim() ? base.note : other.note,
          mood: base.mood || other.mood,
          // D-20261126-118：自定义心境文本按「笔记」同口径合并（非空胜出）
          moodNote: base.moodNote && base.moodNote.trim() ? base.moodNote : other.moodNote,
          starred: Boolean(base.starred || other.starred),
          placedBlockId: base.placedBlockId || other.placedBlockId,
          blueprintId: base.blueprintId || other.blueprintId,
          actualMinutes: base.actualMinutes ?? other.actualMinutes,
          value: base.value ?? other.value,
          bonus: base.bonus ?? other.bonus,
          deletedAt: undefined
        }
      }
      merged[existingIndex] = combined
      if (c.id) idMap.set(c.id, existingIndex)
      if (combined.id) idMap.set(combined.id, existingIndex)
      if (existing.id) idMap.set(existing.id, existingIndex)
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
  remoteDeleted: { date: string; deletedAt: string }[]
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
        blueprintId: c.blueprintId || existing.blueprintId
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
/**
 * 多沙盘合并（D-20261127-127）：
 * - 两侧都先解析成沙盘（只有 legacy showcasePlacements 的一侧视为 sandbox-1）；
 * - 按 id 合并，本地字段优先；placements 按 blueprintId 本地优先、远端独有追加；
 * - 顺序 = 本地沙盘在前，远端独有沙盘追加；
 * - 同一座建筑跨沙盘重复时只保留最先出现的一次（本地优先），保持「一座建筑只陈列在一个沙盘」；
 * - activeSandboxId 本地有效则保留，否则远端 / 第一个。
 * 已知限制：沙盘删除没有墓碑，远端旧数据可能把已删沙盘复活。
 */
function mergeShowcaseSandboxes(
  local: AppState,
  remote: AppState
): { sandboxes: ShowcaseSandbox[]; activeSandboxId: string; placements: ShowcasePlacement[] } {
  const localShowcase = resolveShowcaseState(local)
  const remoteShowcase = resolveShowcaseState(remote)
  const remoteById = new Map(remoteShowcase.sandboxes.map((s) => [s.id, s]))
  const merged: ShowcaseSandbox[] = []
  for (const sandbox of localShowcase.sandboxes) {
    const counterpart = remoteById.get(sandbox.id)
    if (!counterpart) {
      merged.push(sandbox)
      continue
    }
    const placementMap = new Map<string, ShowcasePlacement>()
    for (const p of counterpart.placements) placementMap.set(p.blueprintId, p)
    for (const p of sandbox.placements) placementMap.set(p.blueprintId, p)
    merged.push({
      ...counterpart,
      ...sandbox,
      // 可选字段缺省时不能被另一侧的 undefined 覆盖
      design: sandbox.design ?? counterpart.design,
      placements: [...placementMap.values()]
    })
  }
  const localIds = new Set(localShowcase.sandboxes.map((s) => s.id))
  for (const sandbox of remoteShowcase.sandboxes) {
    if (!localIds.has(sandbox.id)) merged.push(sandbox)
  }

  // 跨沙盘去重：同一 blueprintId 只保留第一次出现（本地沙盘顺序优先）；未知蓝图直接丢弃
  const placed = new Set<string>()
  const sandboxes = merged.map((sandbox) => {
    const placements = sandbox.placements.filter((p) => {
      if (!blueprints[p.blueprintId] || placed.has(p.blueprintId)) return false
      placed.add(p.blueprintId)
      return true
    })
    return placements.length === sandbox.placements.length ? sandbox : { ...sandbox, placements }
  })

  // 上限 4：确定性截断（本地顺序优先），并保证 active 沙盘在保留集合内
  const preferredActiveId =
    [localShowcase.activeId, remoteShowcase.activeId].find((id) =>
      sandboxes.some((s) => s.id === id)
    ) ?? sandboxes[0]?.id
  let capped = sandboxes
  if (capped.length > SHOWCASE_SANDBOX_MAX) {
    capped = capped.slice(0, SHOWCASE_SANDBOX_MAX)
    if (preferredActiveId && !capped.some((s) => s.id === preferredActiveId)) {
      const activeSandbox = sandboxes.find((s) => s.id === preferredActiveId)
      if (activeSandbox) capped[capped.length - 1] = activeSandbox
    }
  }
  const activeSandboxId =
    (preferredActiveId && capped.some((s) => s.id === preferredActiveId)
      ? preferredActiveId
      : capped[0]?.id) ?? 'sandbox-1'
  const active = capped.find((s) => s.id === activeSandboxId) ?? capped[0]
  return { sandboxes: capped, activeSandboxId, placements: active.placements }
}

export function mergeAppState(local: AppState, remote: AppState): AppState {
  const deletedHabits = mergeDeletedHabits(local.deletedHabits, remote.deletedHabits)
  const deletedHabitIds = new Set(deletedHabits.map((entry) => entry.id))
  const mergedHabits = mergeHabits(local.habits, remote.habits)
  // D-20261128-133：删除习惯的墓碑优先于远端旧存档；打卡按 habitId 一并过滤，
  // 避免 rebuildBuilds 把已删习惯的积木重新投影出来。
  const habits = mergedHabits.filter((habit) => !deletedHabitIds.has(habit.id))
  const checkIns = mergeCheckIns(local.checkIns, remote.checkIns, mergedHabits).filter(
    (checkIn) => !deletedHabitIds.has(checkIn.habitId)
  )
  const { claims: dayClaims, deleted: deletedDayClaims } = mergeDayClaims(
    local.dayClaims || [],
    remote.dayClaims || [],
    local.deletedDayClaims || [],
    remote.deletedDayClaims || []
  )

  // 墓碑 GC：清理超过 90 天的删除墓碑，防止存档无限膨胀
  // （已知限制：离线超过 90 天的设备参与合并时，对应删除可能复活一次）
  const gcCutoff = Date.now() - 90 * 86_400_000
  const gcCheckIns = checkIns.filter(
    (c) => !c.deletedAt || new Date(c.deletedAt).getTime() >= gcCutoff
  )
  const gcDeletedClaims = deletedDayClaims.filter(
    (d) => new Date(d.deletedAt).getTime() >= gcCutoff
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
    ...(local.foundationNotes || {})
  }

  const mergedShowcase = mergeShowcaseSandboxes(local, remote)

  // 提醒处置（跳过今天）：按 habit 保留日期更新的一方（记录本身按天覆盖，取新即最新决策）
  const reminderLog: Record<string, ReminderLogEntry> = {}
  const reminderLogIds = new Set([
    ...Object.keys(local.reminderLog || {}),
    ...Object.keys(remote.reminderLog || {})
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
    ...(local.settings || {})
  }

  const activeBlueprintId = local.activeBlueprintId || remote.activeBlueprintId || 'plant'

  // 完成态对账：完成列表取双方并集，但撤销可能让蓝图退回未完成——
  // 重建投影后块数不足者剔除。展台摆放随之对账：无法判定完成态的（真实数据中不存在）保守保留。
  const completedSet = new Set([
    ...(local.completedBlueprintIds || []),
    ...(remote.completedBlueprintIds || [])
  ])
  const activeCompleted = Array.from(completedSet)
    .filter((id) => {
      const total = blueprintBlockCount(id)
      return total !== null && rebuildCountForBlueprint(builds, id) >= total
    })
    .sort()
  const isIncompletePlacement = (p: ShowcasePlacement): boolean => {
    if (!completedSet.has(p.blueprintId)) return false
    const total = blueprintBlockCount(p.blueprintId)
    if (total === null) return false
    return rebuildCountForBlueprint(builds, p.blueprintId) < total
  }
  const showcaseSandboxesFiltered = mergedShowcase.sandboxes.map((sandbox) => ({
    ...sandbox,
    placements: sandbox.placements.filter((p) => !isIncompletePlacement(p))
  }))
  const activeSandboxFiltered =
    showcaseSandboxesFiltered.find((s) => s.id === mergedShowcase.activeSandboxId) ??
    showcaseSandboxesFiltered[0]

  return {
    schemaVersion: 2,
    // 内容版本取双方较高值：旧端与高内容端合并后不能把版本写低（门禁在读取前）
    // 至少为当前内容版本：合并结果可能被本安装包继续产出 v2 建筑，不能写低
    contentVersion: Math.max(
      CONTENT_VERSION,
      local.contentVersion ?? CONTENT_VERSION,
      remote.contentVersion ?? CONTENT_VERSION
    ),
    habits,
    checkIns: gcCheckIns,
    builds,
    activeBlueprintId,
    completedBlueprintIds: activeCompleted,
    settings: settings as AppState['settings'],
    dayClaims,
    deletedDayClaims: gcDeletedClaims,
    deletedHabits,
    repairBricks,
    repairBrickMonth,
    showcasePlacements: activeSandboxFiltered.placements,
    showcaseSandboxes: showcaseSandboxesFiltered,
    activeSandboxId: activeSandboxFiltered.id,
    foundationNotes,
    reminderLog
  }
}

function rebuildCountForBlueprint(builds: AppState['builds'], blueprintId: string): number {
  return builds.filter((b) => b.blueprintId === blueprintId).length
}
