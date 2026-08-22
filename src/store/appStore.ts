import { create } from 'zustand'
import type { AppState, CheckIn, CheckInResult, Habit, Theme } from '../types'
import { canCheckIn } from '../logic/checkin'
import { currentStreak } from '../logic/streak'
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
  }
}

interface AppActions {
  addHabit(name: string, frequency: Habit['frequency']): Habit
  updateHabit(id: string, patch: Partial<Pick<Habit, 'name' | 'frequency'>>): void
  archiveHabit(id: string): void
  checkIn(habitId: string): CheckInResult
  chooseBlueprint(id: string): void
  setTheme(t: Theme): void
  exportData(): string
  importData(json: string): boolean
}

export type AppStore = AppState & AppActions & { hydrated: boolean }

export const useAppStore = create<AppStore>()((set, get) => ({
  ...defaultState(),
  hydrated: false,

  addHabit(name, frequency) {
    const habit: Habit = { id: uid(), name: name.trim(), frequency, createdAt: new Date().toISOString() }
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

  checkIn(habitId): CheckInResult {
    const { habits, checkIns, builds, activeBlueprintId, completedBlueprintIds } = get()
    const day = todayKey()
    const verdict = canCheckIn(habits, checkIns, habitId, day)
    if (!verdict.ok) return { bonus: false, complete: false, reason: verdict.reason }

    const habit = habits.find((h) => h.id === habitId)!
    const entry: CheckIn = { id: uid(), habitId, date: day, at: new Date().toISOString() }
    const nextCheckIns = [...checkIns, entry]
    const streakAfter = currentStreak(habit, nextCheckIns, new Date())
    const bonus = awardBlock(streakAfter)

    const blueprint = getBlueprint(activeBlueprintId)
    const placedCount = builds.filter((b) => b.blueprintId === activeBlueprintId).length
    const slot = nextSlot(blueprint.blocks, placedCount)

    let nextBuilds = builds
    let complete = false
    let nextCompleted = completedBlueprintIds
    if (slot) {
      entry.rewardBlockIndex = placedCount
      nextBuilds = [
        ...builds,
        {
          id: uid(),
          blueprintId: activeBlueprintId,
          index: placedCount,
          placedAt: new Date().toISOString(),
          fromHabitId: habitId,
          bonus,
        },
      ]
      complete = isComplete(blueprint.blocks, placedCount + 1)
      if (complete && !completedBlueprintIds.includes(activeBlueprintId)) {
        nextCompleted = [...completedBlueprintIds, activeBlueprintId]
      }
    } else {
      // 当前蓝图已满（等待选择新蓝图）：打卡照常记录，不掉块
      complete = true
    }

    set({
      checkIns: nextCheckIns,
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
    const { schemaVersion, habits, checkIns, builds, activeBlueprintId, completedBlueprintIds, settings } = get()
    return JSON.stringify({ schemaVersion, habits, checkIns, builds, activeBlueprintId, completedBlueprintIds, settings }, null, 2)
  },

  importData(json) {
    try {
      const parsed: unknown = JSON.parse(json)
      if (!isValidState(parsed)) return false
      set({ ...parsed, hydrated: true })
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
      const { schemaVersion, habits, checkIns, builds, activeBlueprintId, completedBlueprintIds, settings } = state
      void adapter.save({ schemaVersion, habits, checkIns, builds, activeBlueprintId, completedBlueprintIds, settings })
    }, 300)
  })
}
