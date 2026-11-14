import { create } from 'zustand'
import type { CheckIn, CheckInResult, ClaimDayResult, DayClaim, Habit } from '../types'
import { canCheckIn, canClaimDay, habitMetOnDay } from '../logic/checkin'
import { REPAIR_MAX, refreshMonthlyAllowance, repairBricksForStreak } from '../logic/repairBricks'
import { currentStreak, dayClaimStreak } from '../logic/streak'
import { awardBlock, canSelectBlueprint, isComplete, nextSlot } from '../logic/blueprint'
import {
  rebuildBuilds,
  liveCheckInsView,
  buildsMatchFacts,
  removeBlocksAndCompact,
  BLUEPRINT_CAPACITY
} from '../logic/builds'
import { blueprints, getBlueprint } from '../logic/blueprints'
import { canPlaceModel, findNextAvailablePlacement } from '../logic/showcase'
import { todayKey } from '../logic/dates'
import type { StorageAdapter } from '../storage/adapter'
import { prepareImport } from '../storage/adapter'
import { clearHabitSliceCache } from './habitSelectors'
import { serializeState } from './serializeState'
import type { AppStore } from './appStoreTypes'
import { defaultState, reconcileCompletion, uid } from './appStoreHelpers'
import {
  applyDemoCastleState as applyDemoCastleStateToStore,
  initPersistence as initPersistenceWithStore,
  requestFlushNow
} from './persistence'

export type { AppStore }
export { forceFlush, isDemoMode, markDemoMode, persistenceReady } from './persistence'

export const useAppStore = create<AppStore>()((set, get) => ({
  ...defaultState(),
  hydrated: false,

  addHabit(name, frequency, extra) {
    const habit: Habit = {
      id: uid(),
      name: name.trim(),
      frequency,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...extra
    }
    set((s) => ({ habits: [...s.habits, habit] }))
    return habit
  },

  updateHabit(id, patch) {
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === id ? { ...h, ...patch, updatedAt: new Date().toISOString() } : h
      )
    }))
    requestFlushNow()
  },

  archiveHabit(id) {
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === id && !h.archivedAt
          ? { ...h, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : h
      )
    }))
  },

  restoreHabit(id) {
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === id ? { ...h, archivedAt: undefined, updatedAt: new Date().toISOString() } : h
      )
    }))
  },

  deleteHabit(id) {
    const { habits, checkIns, builds, completedBlueprintIds, dayClaims } = get()
    const remainingCheckIns = checkIns.filter((c) => c.habitId !== id)
    const affectedBpIds = new Set(
      builds.filter((b) => b.fromHabitId === id).map((b) => b.blueprintId)
    )
    const nextBuilds = rebuildBuilds(
      liveCheckInsView(remainingCheckIns),
      dayClaims,
      BLUEPRINT_CAPACITY
    )
    const { completed: nextCompleted, showcase: nextShowcase } = reconcileCompletion(
      affectedBpIds,
      nextBuilds,
      completedBlueprintIds,
      get().showcasePlacements ?? []
    )
    // 清理该习惯的提醒处置记录，避免 reminderLog 随习惯删除无限增长
    const reminderLog = { ...(get().reminderLog ?? {}) }
    delete reminderLog[id]
    // 选择器按 habitId 缓存：习惯本体变化后必须失效，否则会读到过期切片
    clearHabitSliceCache()
    set({
      habits: habits.filter((h) => h.id !== id),
      checkIns: remainingCheckIns,
      builds: nextBuilds,
      completedBlueprintIds: nextCompleted,
      showcasePlacements: nextShowcase,
      reminderLog
    })
    requestFlushNow()
  },

  togglePinHabit(id) {
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === id ? { ...h, pinned: !h.pinned, updatedAt: new Date().toISOString() } : h
      )
    }))
  },

  recordCheckInNote(checkInId, note, mood, starred) {
    set((s) => ({
      checkIns: s.checkIns.map((c) =>
        c.id === checkInId
          ? {
              ...c,
              note: note.trim() || undefined,
              mood: mood === null ? undefined : mood !== undefined ? mood : c.mood,
              starred: starred !== undefined ? starred : c.starred
            }
          : c
      )
    }))
  },
  toggleCheckInStar(checkInId) {
    set((s) => ({
      checkIns: s.checkIns.map((c) => (c.id === checkInId ? { ...c, starred: !c.starred } : c))
    }))
  },
  setFoundationNote(blueprintId, noteText) {
    set((s) => ({
      foundationNotes: {
        ...(s.foundationNotes ?? {}),
        [blueprintId]: noteText.trim()
      }
    }))
  },
  checkIn(habitId, actualMinutes, note, counterDelta, mood, starred): CheckInResult {
    const {
      habits,
      checkIns,
      builds,
      activeBlueprintId,
      completedBlueprintIds,
      repairBricks,
      showcasePlacements
    } = get()
    const day = todayKey()
    const verdict = canCheckIn(habits, checkIns, habitId, day)
    if (!verdict.ok) return { bonus: false, complete: false, reason: verdict.reason }

    const habit = habits.find((h) => h.id === habitId)
    const isCounter = habit?.kind === 'counter'
    const todayCheckIns = checkIns.filter((c) => c.habitId === habitId && c.date === day)
    const prevValue = todayCheckIns.reduce((sum, c) => sum + (c.value ?? 0), 0)
    const stepDelta = counterDelta ?? habit?.step ?? 1
    const nextValue = prevValue + stepDelta
    const targetValue = habit?.targetValue ?? 1
    // 掉块判定（counter）：必须「当日该习惯还没掉过块」且本次是正向增量跨过目标。
    // 旧实现只看"跨阈值事件"，导致「达标 → 减一档 → 加回来」可无限重复产出积木。
    const awardedToday = todayCheckIns.some((c) => Boolean(c.placedBlockId))
    const reachedTarget = stepDelta > 0 && prevValue < targetValue && nextValue >= targetValue
    const shouldAwardBlock = !isCounter || (!awardedToday && reachedTarget)

    const blueprint = getBlueprint(activeBlueprintId)
    const placedCount = builds.filter((b) => b.blueprintId === activeBlueprintId).length
    const slot = shouldAwardBlock ? nextSlot(blueprint.blocks, placedCount) : null

    const wasComplete = completedBlueprintIds.includes(activeBlueprintId)
    let nextBuilds = builds
    let complete = false
    let nextCompleted = completedBlueprintIds
    let nextRepair = repairBricks ?? 0
    let nextPlacements = showcasePlacements ?? []
    const blockId = uid()

    // 连击里程碑奖励（B1）：本次打卡后该习惯的连续天数每满 7 天，掉落的这块积木变为点缀色 bonus 块。
    // currentStreak 只按「习惯 × 日期」计数，与打卡记录的其它字段无关，故用最小占位记录参与计算。
    const streakAfter = habit
      ? currentStreak(
          habit,
          [...checkIns, { id: blockId, habitId, date: day, at: '' } as CheckIn],
          new Date()
        )
      : 0
    const isBonus = Boolean(slot) && awardBlock(streakAfter)
    // F8：连击每满 30 天额外奖励 1 块修复积木（与月度额度独立叠加）
    const prevStreak = habit ? currentStreak(habit, checkIns, new Date()) : 0
    nextRepair = repairBricksForStreak(nextRepair, prevStreak, streakAfter)

    if (slot) {
      nextBuilds = [
        ...builds,
        {
          id: blockId,
          blueprintId: activeBlueprintId,
          index: placedCount,
          placedAt: new Date().toISOString(),
          fromHabitId: habitId,
          bonus: isBonus
        }
      ]
      const nowComplete = isComplete(blueprint.blocks, placedCount + 1)
      complete = !wasComplete && nowComplete
      if (nowComplete && !completedBlueprintIds.includes(activeBlueprintId)) {
        nextCompleted = [...completedBlueprintIds, activeBlueprintId]
        nextRepair = Math.min(REPAIR_MAX, nextRepair + 1) // 落成奖励 1 块修复积木（F8 上限放宽到 4 块）
        if (!nextPlacements.some((p) => p.blueprintId === activeBlueprintId)) {
          const placement = findNextAvailablePlacement(
            activeBlueprintId,
            nextPlacements,
            blueprints
          )
          // 展台已满：跳过自动上展台（不阻塞落成）
          if (placement) nextPlacements = [...nextPlacements, placement]
        }
      }
    } else {
      complete = false
    }

    const entry: CheckIn = {
      id: uid(),
      habitId,
      date: day,
      at: new Date().toISOString(),
      placedBlockId: slot ? blockId : undefined,
      blueprintId: slot ? activeBlueprintId : undefined,
      actualMinutes: actualMinutes ?? habit?.targetMinutes,
      value: isCounter ? stepDelta : undefined,
      note: note?.trim() || undefined,
      mood,
      starred,
      bonus: isBonus ? true : undefined
    }

    set({
      checkIns: [...checkIns, entry],
      builds: nextBuilds,
      completedBlueprintIds: nextCompleted,
      repairBricks: nextRepair,
      showcasePlacements: nextPlacements
    })
    requestFlushNow()
    return { placed: slot ?? undefined, bonus: isBonus, complete, checkInId: entry.id }
  },

  uncheckIn(habitId, day) {
    const { habits, checkIns, builds, dayClaims, completedBlueprintIds } = get()
    const targetDay = day ?? todayKey()
    const targetCheckIns = checkIns.filter(
      (c) => !c.deletedAt && c.habitId === habitId && c.date === targetDay
    )
    if (targetCheckIns.length === 0) {
      return { ok: false, habitId, reason: 'no-checkin' }
    }

    const nowIso = new Date().toISOString()
    // 墓碑化打卡（不物理删除）：同步合并时删除胜出，防止撤销被并集复活
    const targetIds = new Set(targetCheckIns.map((c) => c.id))
    const nextCheckIns = checkIns.map((c) =>
      targetIds.has(c.id) ? { ...c, deletedAt: nowIso } : c
    )
    const removedBlockIds = new Set(
      targetCheckIns.map((c) => c.placedBlockId).filter((id): id is string => Boolean(id))
    )
    const removedBlock = removedBlockIds.size > 0

    // 受影响的蓝图 = 被移除块的蓝图（+ 可能被回收的全勤块蓝图）
    const affectedBpIds = new Set<string>()
    for (const b of builds) {
      if (removedBlockIds.has(b.id)) affectedBpIds.add(b.blueprintId)
    }

    // 若撤销导致当日不再全勤：领取记录墓碑化（防反复刷块），精确回收全勤块
    let nextClaims = dayClaims
    let nextDeletedClaims = [...(get().deletedDayClaims ?? [])]
    /** 需要一并回收的全勤块 id */
    const reclaimedBlockIds = new Set<string>()
    if (dayClaims.some((c) => c.date === targetDay)) {
      const activeHabits = habits.filter((h) => !h.archivedAt)
      const stillAllDone =
        activeHabits.length > 0 &&
        activeHabits.every((h) => habitMetOnDay(h, liveCheckInsView(nextCheckIns), targetDay))
      if (!stillAllDone) {
        const claim = dayClaims.find((c) => c.date === targetDay)!
        nextClaims = dayClaims.filter((c) => c.date !== targetDay)
        nextDeletedClaims = [...nextDeletedClaims, { date: targetDay, deletedAt: nowIso }]
        if (claim.blockId && claim.blueprintId) {
          affectedBpIds.add(claim.blueprintId)
          reclaimedBlockIds.add(claim.blockId)
        }
      }
    }

    // 事实层变更后：能安全重建则重建（index 0..N-1 连续压实，多端一致）；
    // 旧档/外部导入的 builds 可能含无法由事实推导的块，此时全量重建会抹掉它们 → 改用保守移除。
    const liveAfterUncheck = liveCheckInsView(nextCheckIns)
    const canRebuild = buildsMatchFacts(builds, liveAfterUncheck, nextClaims)
    const removalIds = new Set<string>([...removedBlockIds, ...reclaimedBlockIds])
    const nextBuilds = canRebuild
      ? rebuildBuilds(liveAfterUncheck, nextClaims)
      : removeBlocksAndCompact(builds, removalIds)

    // 校验受影响蓝图的完成状态，退回未完成时同步移出展台
    const { completed: nextCompleted, showcase: nextShowcase } = reconcileCompletion(
      affectedBpIds,
      nextBuilds,
      completedBlueprintIds,
      get().showcasePlacements ?? []
    )

    set({
      checkIns: nextCheckIns,
      builds: nextBuilds,
      completedBlueprintIds: nextCompleted,
      dayClaims: nextClaims,
      deletedDayClaims: nextDeletedClaims,
      showcasePlacements: nextShowcase
    })
    requestFlushNow()

    return { ok: true, habitId, removedBlock }
  },

  refreshRepairAllowance() {
    const { repairBricks, repairBrickMonth } = get()
    const allowance = refreshMonthlyAllowance(repairBricks ?? 0, repairBrickMonth)
    if (allowance.granted === 0 && repairBrickMonth === allowance.month) return
    set({ repairBricks: allowance.count, repairBrickMonth: allowance.month })
  },

  useRepairBrick(habitId, date) {
    const { habits, checkIns, repairBricks, repairBrickMonth } = get()
    // F8：先结算本月额度（幂等），再判断库存——否则月初第一次补签会被误判为「没有积木」
    const allowance = refreshMonthlyAllowance(repairBricks ?? 0, repairBrickMonth)
    const count = allowance.count
    if (allowance.granted > 0) set({ repairBricks: count, repairBrickMonth: allowance.month })
    if (count <= 0) return { ok: false, reason: 'no-bricks' }
    const habit = habits.find((h) => h.id === habitId)
    if (!habit) return { ok: false, reason: 'no-habit' }
    if (habit.archivedAt) return { ok: false, reason: 'archived' }
    // 拒绝未来日期（补卡只应发生在过去）
    if (date > todayKey()) return { ok: false, reason: 'future' }
    // 拒绝早于习惯创建日：那之前用户还没这个习惯，补出来的连击是假的
    const createdDay = habit.createdAt.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(createdDay) && date < createdDay) {
      return { ok: false, reason: 'before-creation' }
    }
    if (checkIns.some((c) => !c.deletedAt && c.habitId === habitId && c.date === date)) {
      return { ok: false, reason: 'already' }
    }
    const entry: CheckIn = {
      id: uid(),
      habitId,
      date,
      at: new Date().toISOString()
    }
    set({
      checkIns: [...checkIns, entry],
      repairBricks: count - 1,
      repairBrickMonth: allowance.month
    })
    requestFlushNow()
    return { ok: true }
  },

  updateShowcasePlacement(blueprintId, gridX, gridY, rotations) {
    const { showcasePlacements } = get()
    const placements = showcasePlacements ?? []
    const ok = canPlaceModel(
      { blueprintId, gridX, gridY },
      placements,
      blueprints,
      undefined,
      rotations
    )
    if (!ok) return false
    const next = placements.some((p) => p.blueprintId === blueprintId)
      ? placements.map((p) => (p.blueprintId === blueprintId ? { blueprintId, gridX, gridY } : p))
      : [...placements, { blueprintId, gridX, gridY }]
    set({ showcasePlacements: next })
    return true
  },

  checkInDay(): ClaimDayResult {
    const {
      habits,
      checkIns,
      builds,
      activeBlueprintId,
      completedBlueprintIds,
      dayClaims,
      repairBricks,
      showcasePlacements
    } = get()
    const day = todayKey()
    // 全勤判定基于有效打卡（排除墓碑），防止"打卡→领块→撤销→再领"刷块
    const verdict = canClaimDay(habits, liveCheckInsView(checkIns), dayClaims, day)
    if (!verdict.ok) return { bonus: false, complete: false, reason: verdict.reason }

    const claimAt = new Date().toISOString()
    const streakAfter = dayClaimStreak([...dayClaims.map((c) => c.date), day], new Date())
    const isStreakBonus = awardBlock(streakAfter)

    const blueprint = getBlueprint(activeBlueprintId)
    const placedCount = builds.filter((b) => b.blueprintId === activeBlueprintId).length
    const slot = nextSlot(blueprint.blocks, placedCount)

    const wasComplete = completedBlueprintIds.includes(activeBlueprintId)
    let nextBuilds = builds
    let complete = false
    let nextCompleted = completedBlueprintIds
    let nextRepair = repairBricks ?? 0
    let nextPlacements = showcasePlacements ?? []
    // 仅当真正掉块时才记录 blockId（蓝图已建完的领取无块可挂，重建时按空 blockId 跳过）
    const blockId = slot ? uid() : ''

    if (slot) {
      nextBuilds = [
        ...builds,
        {
          id: blockId,
          blueprintId: activeBlueprintId,
          index: placedCount,
          placedAt: claimAt,
          fromHabitId: '__day__',
          bonus: true // 全勤专属奖励块自带高亮/点缀
        }
      ]
      const nowComplete = isComplete(blueprint.blocks, placedCount + 1)
      complete = !wasComplete && nowComplete
      if (nowComplete && !completedBlueprintIds.includes(activeBlueprintId)) {
        nextCompleted = [...completedBlueprintIds, activeBlueprintId]
        nextRepair = Math.min(2, nextRepair + 1)
        if (!nextPlacements.some((p) => p.blueprintId === activeBlueprintId)) {
          const placement = findNextAvailablePlacement(
            activeBlueprintId,
            nextPlacements,
            blueprints
          )
          // 展台已满：跳过自动上展台（不阻塞落成）
          if (placement) nextPlacements = [...nextPlacements, placement]
        }
      }
    }

    const nextClaims: DayClaim[] = [
      ...dayClaims,
      { date: day, claimedAt: claimAt, blockId, blueprintId: activeBlueprintId }
    ]
    set({
      dayClaims: nextClaims,
      builds: nextBuilds,
      completedBlueprintIds: nextCompleted,
      repairBricks: nextRepair,
      showcasePlacements: nextPlacements
    })
    requestFlushNow()
    return { placed: slot ?? undefined, bonus: isStreakBonus, complete }
  },
  chooseBlueprint(id) {
    const { completedBlueprintIds, activeBlueprintId } = get()
    if (id === activeBlueprintId) return
    if (!canSelectBlueprint(id, completedBlueprintIds)) return
    set({ activeBlueprintId: id })
  },
  skipReminderToday(habitId) {
    const { reminderLog } = get()
    set({
      reminderLog: {
        ...(reminderLog ?? {}),
        [habitId]: { date: todayKey(), action: 'skipped' }
      }
    })
  },
  updateSettings(patch) {
    const { settings } = get()
    // 纯状态变更：DOM（data-theme/lang）与跨窗口事件由 App 层订阅 settings 驱动
    set({ settings: { ...settings, ...patch } })
  },

  setTheme(t) {
    get().updateSettings({ theme: t })
  },

  setLanguage(l) {
    get().updateSettings({ language: l })
  },

  exportData() {
    return JSON.stringify(serializeState(get()), null, 2)
  },

  importData(json) {
    try {
      const parsed: unknown = JSON.parse(json)
      // prepareImport：v2 严格校验直通，v1 旧档迁移后校验，损坏/未来版本拒绝
      const prepared = prepareImport(parsed)
      if (!prepared) return false
      set({ ...prepared, hydrated: true, needsUpgrade: false, saveError: undefined })
      requestFlushNow()
      return true
    } catch {
      return false
    }
  }
}))

/** 启动时恢复状态并挂载防抖持久化（StrictMode 下可能调用两次，需幂等） */
export function initPersistence(adapter: StorageAdapter): Promise<void> {
  return initPersistenceWithStore(adapter, useAppStore)
}

/** 演示模式（?demo-castle）：向内存 store 注入已建成的城堡，不读写本地存档 */
export function applyDemoCastleState(): void {
  applyDemoCastleStateToStore(useAppStore)
}
