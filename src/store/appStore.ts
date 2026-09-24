import { create } from 'zustand'
import type {
  AppState,
  CheckIn,
  CheckInResult,
  ClaimDayResult,
  Habit,
  HabitExtra,
  Language,
  MicroMood,
  Theme,
  UndoResult,
} from '../types'
import { canCheckIn, canClaimDay, habitMetOnDay } from '../logic/checkin'
import { dayClaimStreak } from '../logic/streak'
import { awardBlock, canSelectBlueprint, isComplete, nextSlot } from '../logic/blueprint'
import { blueprints, getBlueprint } from '../logic/blueprints'
import { canPlaceModel, findNextAvailablePlacement } from '../logic/showcase'
import { dateKey, todayKey } from '../logic/dates'
import type { StorageAdapter } from '../storage/adapter'
import { isValidState } from '../storage/adapter'

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

function defaultState(): AppState {
  const initialLang: Language =
    typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh' : 'en'
  return {
    schemaVersion: 1,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: initialLang },
    dayClaims: [],
    repairBricks: 0,
    showcasePlacements: [],
    foundationNotes: {},
  }
}

interface AppActions {
  addHabit(name: string, frequency: Habit['frequency'], extra?: HabitExtra): Habit
  updateHabit(
    id: string,
    patch: Partial<Pick<Habit, 'name' | 'frequency' | 'period' | 'targetMinutes' | 'targetValue' | 'unit' | 'step' | 'category' | 'pinned' | 'note'>>,
  ): void
  archiveHabit(id: string): void
  /** 永久删除习惯及其打卡记录 */
  deleteHabit(id: string): void
  /** 恢复归档的习惯 */
  restoreHabit(id: string): void
  /** 置顶/取消置顶习惯 */
  togglePinHabit(id: string): void
  /** 记录或修改某次打卡的笔记/随笔反思及微状态、星标（mood 为 null 时清除微状态） */
  recordCheckInNote(checkInId: string, note: string, mood?: MicroMood | null, starred?: boolean): void
  toggleCheckInStar(checkInId: string): void
  /** 记录蓝图落成奠基石铭言 */
  setFoundationNote(blueprintId: string, noteText: string): void
  /** 单个任务打卡：记录完成，并为当前蓝图掉落 1 块积木（支持计数步进与随笔笔记、微状态、星标） */
  checkIn(habitId: string, actualMinutes?: number, note?: string, counterDelta?: number, mood?: MicroMood, starred?: boolean): CheckInResult
  uncheckIn(habitId: string, day?: string): UndoResult
  /** 每日大满贯打卡：全部任务完成后领取额外里程碑奖励积木 */
  checkInDay(): ClaimDayResult
  /** 消耗 1 块修复积木挽回过去某天的遗漏打卡 */
  useRepairBrick(habitId: string, date: string): { ok: boolean; reason?: string }
  /** 展台沙盘位置调整（带 AABB 碰撞检测） */
  updateShowcasePlacement(blueprintId: string, gridX: number, gridY: number): boolean
  chooseBlueprint(id: string): void
  setTheme(t: Theme): void
  setLanguage(l: Language): void
  exportData(): string
  importData(json: string): boolean
}

export type AppStore = AppState & AppActions & { hydrated: boolean }

export const useAppStore = create<AppStore>()((set, get) => ({
  ...defaultState(),
  hydrated: false,

  addHabit(name, frequency, extra) {
    const habit: Habit = {
      id: uid(),
      name: name.trim(),
      frequency,
      createdAt: new Date().toISOString(),
      ...extra,
    }
    set((s) => ({ habits: [...s.habits, habit] }))
    return habit
  },

  updateHabit(id, patch) {
    set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) }))
  },

  archiveHabit(id) {
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === id && !h.archivedAt ? { ...h, archivedAt: new Date().toISOString() } : h,
      ),
    }))
  },

  restoreHabit(id) {
    set((s) => ({
      habits: s.habits.map((h) => (h.id === id ? { ...h, archivedAt: undefined } : h)),
    }))
  },

  deleteHabit(id) {
    set((s) => ({
      habits: s.habits.filter((h) => h.id !== id),
      checkIns: s.checkIns.filter((c) => c.habitId !== id),
    }))
  },

  togglePinHabit(id) {
    set((s) => ({
      habits: s.habits.map((h) => (h.id === id ? { ...h, pinned: !h.pinned } : h)),
    }))
  },

  recordCheckInNote(checkInId, note, mood, starred) {
    set((s) => ({
      checkIns: s.checkIns.map((c) =>
        c.id === checkInId
          ? {
              ...c,
              note: note.trim() || undefined,
              mood: mood === null ? undefined : (mood !== undefined ? mood : c.mood),
              starred: starred !== undefined ? starred : c.starred,
            }
          : c,
      ),
    }))
  },
  toggleCheckInStar(checkInId) {
    set((s) => ({
      checkIns: s.checkIns.map((c) =>
        c.id === checkInId ? { ...c, starred: !c.starred } : c,
      ),
    }))
  },
  setFoundationNote(blueprintId, noteText) {
    set((s) => ({
      foundationNotes: {
        ...(s.foundationNotes ?? {}),
        [blueprintId]: noteText.trim(),
      },
    }))
  },
  checkIn(habitId, actualMinutes, note, counterDelta, mood, starred): CheckInResult {
    const { habits, checkIns, builds, activeBlueprintId, completedBlueprintIds, repairBricks, showcasePlacements } = get()
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
    const reachedTarget = prevValue < targetValue && nextValue >= targetValue
    const shouldAwardBlock = !isCounter || reachedTarget

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

    if (slot) {
      nextBuilds = [
        ...builds,
        {
          id: blockId,
          blueprintId: activeBlueprintId,
          index: placedCount,
          placedAt: new Date().toISOString(),
          fromHabitId: habitId,
          bonus: false,
        },
      ]
      const nowComplete = isComplete(blueprint.blocks, placedCount + 1)
      complete = !wasComplete && nowComplete
      if (nowComplete && !completedBlueprintIds.includes(activeBlueprintId)) {
        nextCompleted = [...completedBlueprintIds, activeBlueprintId]
        nextRepair = Math.min(2, nextRepair + 1) // 落成奖励 1 块修复积木，上限 2 块
        if (!nextPlacements.some((p) => p.blueprintId === activeBlueprintId)) {
          const placement = findNextAvailablePlacement(activeBlueprintId, nextPlacements, blueprints)
          nextPlacements = [...nextPlacements, placement]
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
      actualMinutes: actualMinutes ?? habit?.targetMinutes,
      value: isCounter ? stepDelta : undefined,
      note: note?.trim() || undefined,
      mood,
      starred,
    }

    set({
      checkIns: [...checkIns, entry],
      builds: nextBuilds,
      completedBlueprintIds: nextCompleted,
      repairBricks: nextRepair,
      showcasePlacements: nextPlacements,
    })
    return { placed: slot ?? undefined, bonus: false, complete, checkInId: entry.id }
  },

  uncheckIn(habitId, day) {
    const { habits, checkIns, builds, dayClaims, completedBlueprintIds, activeBlueprintId } = get()
    const targetDay = day ?? todayKey()
    const targetCheckIns = checkIns.filter((c) => c.habitId === habitId && c.date === targetDay)
    if (targetCheckIns.length === 0) {
      return { ok: false, habitId, reason: 'no-checkin' }
    }

    const removedBlockIds = new Set(
      targetCheckIns.map((c) => c.placedBlockId).filter((id): id is string => Boolean(id)),
    )
    const nextCheckIns = checkIns.filter((c) => !(c.habitId === habitId && c.date === targetDay))
    let nextBuilds = builds.filter((b) => !removedBlockIds.has(b.id))
    const removedBlock = removedBlockIds.size > 0
    const affectedBlueprintId = activeBlueprintId

    // 若撤销导致当日不再全勤，移除当日 dayClaims 记录并收回全勤奖励块（防止反复刷块）
    let nextClaims = dayClaims
    if (dayClaims.includes(targetDay)) {
      const activeHabits = habits.filter((h) => !h.archivedAt)
      const stillAllDone =
        activeHabits.length > 0 &&
        activeHabits.every((h) => habitMetOnDay(h, nextCheckIns, targetDay))
      if (!stillAllDone) {
        nextClaims = dayClaims.filter((d) => d !== targetDay)
        const dayBlock = nextBuilds.find(
          (b) =>
            b.fromHabitId === '__day__' &&
            (b.placedAt.startsWith(targetDay) || dateKey(new Date(b.placedAt)) === targetDay),
        )
        if (dayBlock) {
          nextBuilds = nextBuilds.filter((b) => b.id !== dayBlock.id)
        }
      }
    }

    // 校验受影响蓝图的完成状态
    let nextCompleted = completedBlueprintIds
    const affectedIds = [affectedBlueprintId, activeBlueprintId].filter(
      (id, idx, arr) => arr.indexOf(id) === idx,
    )
    for (const bpId of affectedIds) {
      if (nextCompleted.includes(bpId)) {
        const bp = getBlueprint(bpId)
        const count = nextBuilds.filter((b) => b.blueprintId === bpId).length
        if (count < bp.blocks.length) {
          nextCompleted = nextCompleted.filter((id) => id !== bpId)
        }
      }
    }

    set({
      checkIns: nextCheckIns,
      builds: nextBuilds,
      completedBlueprintIds: nextCompleted,
      dayClaims: nextClaims,
    })

    return { ok: true, habitId, removedBlock }
  },

  useRepairBrick(habitId, date) {
    const { habits, checkIns, repairBricks } = get()
    const count = repairBricks ?? 0
    if (count <= 0) return { ok: false, reason: 'no-bricks' }
    const habit = habits.find((h) => h.id === habitId)
    if (!habit) return { ok: false, reason: 'no-habit' }
    if (checkIns.some((c) => c.habitId === habitId && c.date === date)) {
      return { ok: false, reason: 'already' }
    }
    const entry: CheckIn = {
      id: uid(),
      habitId,
      date,
      at: new Date().toISOString(),
    }
    set({
      checkIns: [...checkIns, entry],
      repairBricks: count - 1,
    })
    return { ok: true }
  },

  updateShowcasePlacement(blueprintId, gridX, gridY) {
    const { showcasePlacements } = get()
    const placements = showcasePlacements ?? []
    const ok = canPlaceModel({ blueprintId, gridX, gridY }, placements, blueprints)
    if (!ok) return false
    const next = placements.some((p) => p.blueprintId === blueprintId)
      ? placements.map((p) => (p.blueprintId === blueprintId ? { blueprintId, gridX, gridY } : p))
      : [...placements, { blueprintId, gridX, gridY }]
    set({ showcasePlacements: next })
    return true
  },

  checkInDay(): ClaimDayResult {
    const { habits, checkIns, builds, activeBlueprintId, completedBlueprintIds, dayClaims, repairBricks, showcasePlacements } = get()
    const day = todayKey()
    const verdict = canClaimDay(habits, checkIns, dayClaims, day)
    if (!verdict.ok) return { bonus: false, complete: false, reason: verdict.reason }

    const nextClaims = [...dayClaims, day]
    const streakAfter = dayClaimStreak(nextClaims, new Date())
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
    if (slot) {
      nextBuilds = [
        ...builds,
        {
          id: uid(),
          blueprintId: activeBlueprintId,
          index: placedCount,
          placedAt: new Date().toISOString(),
          fromHabitId: '__day__',
          bonus: true, // 全勤专属奖励块自带高亮/点缀
        },
      ]
      const nowComplete = isComplete(blueprint.blocks, placedCount + 1)
      complete = !wasComplete && nowComplete
      if (nowComplete && !completedBlueprintIds.includes(activeBlueprintId)) {
        nextCompleted = [...completedBlueprintIds, activeBlueprintId]
        nextRepair = Math.min(2, nextRepair + 1)
        if (!nextPlacements.some((p) => p.blueprintId === activeBlueprintId)) {
          const placement = findNextAvailablePlacement(activeBlueprintId, nextPlacements, blueprints)
          nextPlacements = [...nextPlacements, placement]
        }
      }
    }
    set({
      dayClaims: nextClaims,
      builds: nextBuilds,
      completedBlueprintIds: nextCompleted,
      repairBricks: nextRepair,
      showcasePlacements: nextPlacements,
    })
    return { placed: slot ?? undefined, bonus: isStreakBonus || true, complete }
  },
  chooseBlueprint(id) {
    const { completedBlueprintIds, activeBlueprintId } = get()
    if (id === activeBlueprintId) return
    if (!canSelectBlueprint(id, completedBlueprintIds)) return
    set({ activeBlueprintId: id })
  },

  setTheme(t) {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = t
    }
    if (get().settings.theme === t) return
    set((s) => ({ settings: { ...s.settings, theme: t } }))
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      void import('@tauri-apps/api/event').then(({ emit }) => emit('theme-changed', t))
    }
  },

  setLanguage(l) {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = l
    }
    if (get().settings.language === l) return
    set((s) => ({ settings: { ...s.settings, language: l } }))
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      void import('@tauri-apps/api/event').then(({ emit }) => emit('language-changed', l))
    }
  },

  exportData() {
    const {
      schemaVersion,
      habits,
      checkIns,
      builds,
      activeBlueprintId,
      completedBlueprintIds,
      settings,
      dayClaims,
      repairBricks,
      showcasePlacements,
      foundationNotes,
    } = get()
    return JSON.stringify(
      {
        schemaVersion,
        habits,
        checkIns,
        builds,
        activeBlueprintId,
        completedBlueprintIds,
        settings,
        dayClaims,
        repairBricks,
        showcasePlacements,
        foundationNotes,
      },
      null,
      2,
    )
  },

  importData(json) {
    try {
      const parsed: unknown = JSON.parse(json)
      if (!isValidState(parsed)) return false
      set({
        ...parsed,
        dayClaims: Array.isArray(parsed.dayClaims) ? parsed.dayClaims : [],
        hydrated: true,
      })
      document.documentElement.dataset.theme = parsed.settings.theme
      if (parsed.settings.language) {
        document.documentElement.lang = parsed.settings.language
      }
      return true
    } catch {
      return false
    }
  },
}))

/** 启动时恢复状态并挂载防抖持久化（StrictMode 下可能调用两次，需幂等） */
let persistenceStarted = false

export async function initPersistence(adapter: StorageAdapter): Promise<void> {
  if (persistenceStarted) return
  persistenceStarted = true

  // 演示模式：?demo-castle 直接在内存里放一座建成的城堡（不读写本地存档）
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo-castle')) {
    const N = getBlueprint('castle').blocks.length
    useAppStore.setState({
      builds: Array.from({ length: N }, (_, i) => ({
        id: `demo-${i}`,
        blueprintId: 'castle',
        index: i,
        placedAt: new Date(Date.now() - (N - i) * 86_400_000).toISOString(),
        fromHabitId: '__day__',
        bonus: false,
      })),
      completedBlueprintIds: ['castle'],
    })
    return
  }

  const saved = await adapter.load()
  if (saved) {
    const lang = saved.settings.language ?? (typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh' : 'en')
    useAppStore.setState({ ...saved, settings: { ...saved.settings, language: lang }, hydrated: true })
    document.documentElement.dataset.theme = saved.settings.theme
    document.documentElement.lang = lang
  } else {
    const initialLang = typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh' : 'en'
    useAppStore.setState({ hydrated: true })
    document.documentElement.lang = initialLang
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  useAppStore.subscribe((state) => {
    if (!state.hydrated) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      const {
        schemaVersion,
        habits,
        checkIns,
        builds,
        activeBlueprintId,
        completedBlueprintIds,
        settings,
        dayClaims,
        repairBricks,
        showcasePlacements,
        foundationNotes,
      } = state
      void adapter.save({
        schemaVersion,
        habits,
        checkIns,
        builds,
        activeBlueprintId,
        completedBlueprintIds,
        settings,
        dayClaims,
        repairBricks,
        showcasePlacements,
        foundationNotes,
      })
    }, 300)
  })
}
