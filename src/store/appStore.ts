import { create } from 'zustand'
import type {
  CheckIn,
  CheckInResult,
  ClaimDayResult,
  DayClaim,
  Habit,
  ShowcasePlacement
} from '../types'
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
import {
  SHOWCASE_SANDBOX_MAX,
  canPlaceModel,
  canRotatePlacement,
  createShowcaseSandbox,
  findNextAvailablePlacement,
  normalizeRotation,
  normalizeSandboxDesign,
  rotationsFromPlacements
} from '../logic/showcase'
import { todayKey } from '../logic/dates'
import type { StorageAdapter } from '../storage/adapter'
import { prepareImport } from '../storage/adapter'
import { clearHabitSliceCache } from './habitSelectors'
import { serializeState } from './serializeState'
import type { AppStore } from './appStoreTypes'
import { defaultState, reconcileCompletion, uid } from './appStoreHelpers'
import {
  removePlacementsEverywhere,
  resolveShowcaseState,
  setSandboxPlacements,
  showcaseFields
} from '../logic/showcaseState'
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
    const { habits, checkIns, builds, completedBlueprintIds, dayClaims, deletedHabits } = get()
    const deletedAt = new Date().toISOString()
    const remainingCheckIns = checkIns.filter((c) => c.habitId !== id)
    const liveAfter = liveCheckInsView(remainingCheckIns)
    const removedBuildIds = new Set(builds.filter((b) => b.fromHabitId === id).map((b) => b.id))
    // 与 uncheckIn 同口径：投影与事实一致才全量重建；旧档/外部导入的遗留块走保守移除，
    // 否则删除任意习惯都会把无法由事实推导的积木一并抹掉（A5b/A7、D-20261128-133）。
    const nextBuilds = buildsMatchFacts(builds, liveAfter, dayClaims)
      ? rebuildBuilds(liveAfter, dayClaims, BLUEPRINT_CAPACITY)
      : removeBlocksAndCompact(builds, removedBuildIds)

    // 所有块数变化的蓝图都要对账，而不只是被删习惯自己的蓝图
    const beforeCounts = new Map<string, number>()
    for (const b of builds) {
      beforeCounts.set(b.blueprintId, (beforeCounts.get(b.blueprintId) ?? 0) + 1)
    }
    const afterCounts = new Map<string, number>()
    for (const b of nextBuilds) {
      afterCounts.set(b.blueprintId, (afterCounts.get(b.blueprintId) ?? 0) + 1)
    }
    const affectedBpIds = new Set<string>()
    for (const bpId of new Set([...beforeCounts.keys(), ...afterCounts.keys()])) {
      if ((beforeCounts.get(bpId) ?? 0) !== (afterCounts.get(bpId) ?? 0)) affectedBpIds.add(bpId)
    }
    const { completed: nextCompleted, removed } = reconcileCompletion(
      affectedBpIds,
      nextBuilds,
      completedBlueprintIds
    )
    // 完成态回退的蓝图要从所有沙盘上撤下（D-20261127-127）
    const showcase = resolveShowcaseState(get())
    const nextSandboxes = removePlacementsEverywhere(showcase.sandboxes, removed)
    // 清理该习惯的提醒处置记录，避免 reminderLog 随习惯删除无限增长
    const reminderLog = { ...(get().reminderLog ?? {}) }
    delete reminderLog[id]
    // D-20261128-133：删除墓碑随存档/同步保留，远端旧存档不得把习惯及其打卡复活
    const nextDeletedHabits = [
      ...(deletedHabits ?? []).filter((entry) => entry.id !== id),
      { id, deletedAt }
    ]
    // 选择器按 habitId 缓存：习惯本体变化后必须失效，否则会读到过期切片
    clearHabitSliceCache()
    set({
      habits: habits.filter((h) => h.id !== id),
      checkIns: remainingCheckIns,
      builds: nextBuilds,
      completedBlueprintIds: nextCompleted,
      deletedHabits: nextDeletedHabits,
      ...showcaseFields(nextSandboxes, showcase.activeId),
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

  recordCheckInNote(checkInId, note, mood, starred, moodNote) {
    set((s) => ({
      checkIns: s.checkIns.map((c) => {
        if (c.id !== checkInId) return c
        // 预设心境与自定义心境互斥：写了自定义文本就清掉预设，反之亦然
        const nextMoodNote = moodNote === null ? undefined : moodNote
        const customText = typeof nextMoodNote === 'string' ? nextMoodNote.trim() : undefined
        const explicitMood = mood === null ? undefined : mood !== undefined ? mood : c.mood
        return {
          ...c,
          note: note.trim() || undefined,
          mood: customText ? undefined : explicitMood,
          moodNote: customText || undefined,
          starred: starred !== undefined ? starred : c.starred
        }
      })
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
    const { habits, checkIns, builds, activeBlueprintId, completedBlueprintIds, repairBricks } =
      get()
    const showcase = resolveShowcaseState(get())
    let nextSandboxes = showcase.sandboxes
    let nextPlacements = showcase.active.placements
    const day = todayKey()
    const verdict = canCheckIn(habits, checkIns, habitId, day)
    if (!verdict.ok) return { bonus: false, complete: false, reason: verdict.reason }

    const habit = habits.find((h) => h.id === habitId)
    const isCounter = habit?.kind === 'counter'
    const todayCheckIns = checkIns.filter(
      (c) => c.habitId === habitId && c.date === day && !c.deletedAt
    )
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
          if (placement) {
            nextPlacements = [...nextPlacements, placement]
            nextSandboxes = setSandboxPlacements(nextSandboxes, showcase.activeId, nextPlacements)
          }
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
      ...showcaseFields(nextSandboxes, showcase.activeId)
    })
    requestFlushNow()
    return { placed: slot ?? undefined, bonus: isBonus, complete, checkInId: entry.id }
  },

  uncheckIn(habitId, day) {
    const { habits, checkIns, builds, dayClaims, completedBlueprintIds } = get()
    const showcase = resolveShowcaseState(get())
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

    // 校验受影响蓝图的完成状态，退回未完成时从所有沙盘撤下
    const { completed: nextCompleted, removed } = reconcileCompletion(
      affectedBpIds,
      nextBuilds,
      completedBlueprintIds
    )
    const nextSandboxes = removePlacementsEverywhere(showcase.sandboxes, removed)

    set({
      checkIns: nextCheckIns,
      builds: nextBuilds,
      completedBlueprintIds: nextCompleted,
      dayClaims: nextClaims,
      deletedDayClaims: nextDeletedClaims,
      ...showcaseFields(nextSandboxes, showcase.activeId)
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

  updateShowcasePlacement(blueprintId, gridX, gridY) {
    const showcase = resolveShowcaseState(get())
    const placements = showcase.active.placements
    const ok = canPlaceModel({ blueprintId, gridX, gridY }, placements, blueprints)
    if (!ok) return false
    // 保留已有 rotation（拖拽只改位置，不改朝向）
    const next = placements.some((p) => p.blueprintId === blueprintId)
      ? placements.map((p) => (p.blueprintId === blueprintId ? { ...p, gridX, gridY } : p))
      : [...placements, { blueprintId, gridX, gridY }]
    const nextSandboxes = setSandboxPlacements(showcase.sandboxes, showcase.activeId, next)
    set(showcaseFields(nextSandboxes, showcase.activeId))
    return true
  },

  rotateShowcasePlacement(blueprintId) {
    const showcase = resolveShowcaseState(get())
    const placement = showcase.active.placements.find((p) => p.blueprintId === blueprintId)
    if (!placement) return false
    const nextRotation = (normalizeRotation(placement.rotation ?? 0) + 1) % 4
    const ok = canRotatePlacement(
      blueprintId,
      placement.gridX,
      placement.gridY,
      nextRotation,
      showcase.active.placements,
      blueprints
    )
    if (!ok) return false
    const next = showcase.active.placements.map((p) =>
      p.blueprintId === blueprintId
        ? { ...p, rotation: nextRotation === 0 ? undefined : nextRotation }
        : p
    )
    const nextSandboxes = setSandboxPlacements(showcase.sandboxes, showcase.activeId, next)
    set(showcaseFields(nextSandboxes, showcase.activeId))
    return true
  },

  autoArrangeShowcase() {
    const state = get()
    const showcase = resolveShowcaseState(state)
    // 只重排当前沙盘已有的陈列，不把其他沙盘 / 堆场里的建筑拉进来（保持全局唯一陈列）
    const source = showcase.active.placements.map((p) => p.blueprintId)
    const rotations = rotationsFromPlacements(showcase.active.placements)
    const next: ShowcasePlacement[] = []
    let overflow = false
    for (const blueprintId of source) {
      const placement = findNextAvailablePlacement(
        blueprintId,
        next,
        blueprints,
        undefined,
        rotations
      )
      if (!placement) {
        overflow = true
        break
      }
      next.push(placement)
    }
    // 放不下时保持原布局不动，交由页面提示，避免自动排列把建筑挤回堆场
    if (overflow) return false
    const nextSandboxes = setSandboxPlacements(showcase.sandboxes, showcase.activeId, next)
    set(showcaseFields(nextSandboxes, showcase.activeId))
    return true
  },

  tuckShowcaseBuilding(blueprintId) {
    const showcase = resolveShowcaseState(get())
    if (!showcase.active.placements.some((p) => p.blueprintId === blueprintId)) return false
    const next = showcase.active.placements.filter((p) => p.blueprintId !== blueprintId)
    const nextSandboxes = setSandboxPlacements(showcase.sandboxes, showcase.activeId, next)
    set(showcaseFields(nextSandboxes, showcase.activeId))
    return true
  },

  placeShowcaseBuilding(blueprintId) {
    const state = get()
    if (!state.completedBlueprintIds.includes(blueprintId)) return false
    const showcase = resolveShowcaseState(state)
    if (showcase.active.placements.some((p) => p.blueprintId === blueprintId)) return false
    const placement = findNextAvailablePlacement(
      blueprintId,
      showcase.active.placements,
      blueprints
    )
    if (!placement) return false
    // 全局唯一陈列：若它在别的沙盘上，先从那里移除再放到当前沙盘
    const cleared = removePlacementsEverywhere(showcase.sandboxes, new Set([blueprintId]))
    const activeAfterMove = cleared.find((s) => s.id === showcase.activeId) ?? cleared[0]
    const nextSandboxes = setSandboxPlacements(cleared, activeAfterMove.id, [
      ...activeAfterMove.placements,
      placement
    ])
    set(showcaseFields(nextSandboxes, activeAfterMove.id))
    return true
  },

  switchShowcaseSandbox(id) {
    const showcase = resolveShowcaseState(get())
    if (!showcase.sandboxes.some((s) => s.id === id)) return false
    set(showcaseFields(showcase.sandboxes, id))
    return true
  },

  addShowcaseSandbox() {
    const showcase = resolveShowcaseState(get())
    if (showcase.sandboxes.length >= SHOWCASE_SANDBOX_MAX) return null
    // 使用全局唯一 id（两台设备离线各建沙盘时不会撞号，避免同步合并成一桌）
    const id = `sandbox-${uid()}`
    const sandbox = createShowcaseSandbox(id, showcase.sandboxes.length)
    const next = [...showcase.sandboxes, sandbox]
    set(showcaseFields(next, id))
    return id
  },

  removeShowcaseSandbox(id) {
    const showcase = resolveShowcaseState(get())
    if (showcase.sandboxes.length <= 1) return false
    const next = showcase.sandboxes.filter((s) => s.id !== id)
    if (next.length === showcase.sandboxes.length) return false
    const activeId = showcase.activeId === id ? next[0].id : showcase.activeId
    set(showcaseFields(next, activeId))
    return true
  },

  setShowcaseSandboxDesign(id, design) {
    const showcase = resolveShowcaseState(get())
    if (!showcase.sandboxes.some((s) => s.id === id)) return false
    const clean = normalizeSandboxDesign(design)
    const next = showcase.sandboxes.map((s) => (s.id === id ? { ...s, design: clean } : s))
    set(showcaseFields(next, showcase.activeId))
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
      repairBricks
    } = get()
    const showcase = resolveShowcaseState(get())
    let nextSandboxes = showcase.sandboxes
    let nextPlacements = showcase.active.placements
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
        nextRepair = Math.min(REPAIR_MAX, nextRepair + 1)
        if (!nextPlacements.some((p) => p.blueprintId === activeBlueprintId)) {
          const placement = findNextAvailablePlacement(
            activeBlueprintId,
            nextPlacements,
            blueprints
          )
          // 展台已满：跳过自动上展台（不阻塞落成）
          if (placement) {
            nextPlacements = [...nextPlacements, placement]
            nextSandboxes = setSandboxPlacements(nextSandboxes, showcase.activeId, nextPlacements)
          }
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
      ...showcaseFields(nextSandboxes, showcase.activeId)
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
