import { create } from 'zustand'
import type {
  AppState,
  CheckIn,
  CheckInResult,
  ClaimDayResult,
  Habit,
  HabitExtra,
  Theme,
} from '../types'
import { canCheckIn, canClaimDay } from '../logic/checkin'
import { dayClaimStreak } from '../logic/streak'
import { awardBlock, isComplete, nextSlot } from '../logic/blueprint'
import { getBlueprint } from '../logic/blueprints'
import { todayKey } from '../logic/dates'
import type { StorageAdapter } from '../storage/adapter'
import { isValidState } from '../storage/adapter'

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

function defaultState(): AppState {
  return {
    schemaVersion: 1,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'castle',
    completedBlueprintIds: [],
    settings: { theme: 'light' },
    dayClaims: [],
  }
}

interface AppActions {
  addHabit(name: string, frequency: Habit['frequency'], extra?: HabitExtra): Habit
  updateHabit(
    id: string,
    patch: Partial<Pick<Habit, 'name' | 'frequency' | 'period' | 'targetMinutes' | 'note'>>,
  ): void
  archiveHabit(id: string): void
  /** 永久删除习惯及其打卡记录 */
  deleteHabit(id: string): void
  /** 恢复归档的习惯 */
  restoreHabit(id: string): void
  /** 单个任务打卡：只记录完成，不掉积木 */
  checkIn(habitId: string): CheckInResult
  /** 每日打卡：全部任务完成后领取一块积木 */
  checkInDay(): ClaimDayResult
  chooseBlueprint(id: string): void
  setTheme(t: Theme): void
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

  checkIn(habitId): CheckInResult {
    const { habits, checkIns } = get()
    const day = todayKey()
    const verdict = canCheckIn(habits, checkIns, habitId, day)
    if (!verdict.ok) return { bonus: false, complete: false, reason: verdict.reason }
    const entry: CheckIn = { id: uid(), habitId, date: day, at: new Date().toISOString() }
    set({ checkIns: [...checkIns, entry] })
    return { bonus: false, complete: false }
  },

  checkInDay(): ClaimDayResult {
    const { habits, checkIns, builds, activeBlueprintId, completedBlueprintIds, dayClaims } = get()
    const day = todayKey()
    const verdict = canClaimDay(habits, checkIns, dayClaims, day)
    if (!verdict.ok) return { bonus: false, complete: false, reason: verdict.reason }

    const nextClaims = [...dayClaims, day]
    const streakAfter = dayClaimStreak(nextClaims, new Date())
    const bonus = awardBlock(streakAfter)

    const blueprint = getBlueprint(activeBlueprintId)
    const placedCount = builds.filter((b) => b.blueprintId === activeBlueprintId).length
    const slot = nextSlot(blueprint.blocks, placedCount)

    let nextBuilds = builds
    let complete = false
    let nextCompleted = completedBlueprintIds
    if (slot) {
      nextBuilds = [
        ...builds,
        {
          id: uid(),
          blueprintId: activeBlueprintId,
          index: placedCount,
          placedAt: new Date().toISOString(),
          fromHabitId: '__day__',
          bonus,
        },
      ]
      complete = isComplete(blueprint.blocks, placedCount + 1)
      if (complete && !completedBlueprintIds.includes(activeBlueprintId)) {
        nextCompleted = [...completedBlueprintIds, activeBlueprintId]
      }
    } else {
      complete = true
    }

    set({
      dayClaims: nextClaims,
      builds: nextBuilds,
      completedBlueprintIds: nextCompleted,
    })
    return { placed: slot ?? undefined, bonus, complete }
  },

  chooseBlueprint(id) {
    getBlueprint(id) // 校验存在
    set({ activeBlueprintId: id })
  },

  setTheme(t) {
    document.documentElement.dataset.theme = t
    set((s) => ({ settings: { ...s.settings, theme: t } }))
  },

  exportData() {
    const { schemaVersion, habits, checkIns, builds, activeBlueprintId, completedBlueprintIds, settings, dayClaims } = get()
    return JSON.stringify(
      { schemaVersion, habits, checkIns, builds, activeBlueprintId, completedBlueprintIds, settings, dayClaims },
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
    const N = 161
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
    useAppStore.setState({ ...saved, hydrated: true })
    document.documentElement.dataset.theme = saved.settings.theme
  } else {
    useAppStore.setState({ hydrated: true })
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  useAppStore.subscribe((state) => {
    if (!state.hydrated) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      const { schemaVersion, habits, checkIns, builds, activeBlueprintId, completedBlueprintIds, settings, dayClaims } = state
      void adapter.save({ schemaVersion, habits, checkIns, builds, activeBlueprintId, completedBlueprintIds, settings, dayClaims })
    }, 300)
  })
}
