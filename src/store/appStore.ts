import { create } from 'zustand'
import type {
  AppSettings,
  AppState,
  CheckIn,
  CheckInResult,
  ClaimDayResult,
  DayClaim,
  Habit,
  HabitExtra,
  Language,
  MicroMood,
  PlacedBlock,
  ShowcasePlacement,
  Theme,
  UndoResult,
} from '../types'
import { canCheckIn, canClaimDay, habitMetOnDay } from '../logic/checkin'
import { dayClaimStreak } from '../logic/streak'
import { awardBlock, canSelectBlueprint, isComplete, nextSlot } from '../logic/blueprint'
import { rebuildBuilds, liveCheckInsView } from '../logic/builds'
import { blueprints, getBlueprint } from '../logic/blueprints'
import { canPlaceModel, findNextAvailablePlacement } from '../logic/showcase'
import { todayKey } from '../logic/dates'
import type { StorageAdapter } from '../storage/adapter'
import { prepareImport } from '../storage/adapter'

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

/** 对账受影响蓝图的完成状态：重建后块数不足者退回未完成，并同步移出展台 */
function reconcileCompletion(
  affectedBpIds: Set<string>,
  nextBuilds: PlacedBlock[],
  completedBlueprintIds: string[],
  showcase: ShowcasePlacement[],
): { completed: string[]; showcase: ShowcasePlacement[] } {
  let completed = completedBlueprintIds
  let nextShowcase = showcase
  for (const bpId of affectedBpIds) {
    if (!completed.includes(bpId)) continue
    const bp = getBlueprint(bpId)
    const count = nextBuilds.filter((b) => b.blueprintId === bpId).length
    if (count < bp.blocks.length) {
      completed = completed.filter((x) => x !== bpId)
      nextShowcase = nextShowcase.filter((p) => p.blueprintId !== bpId)
    }
  }
  return { completed, showcase: nextShowcase }
}

function defaultState(): AppState {
  const initialLang: Language =
    typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh' : 'en'
  return {
    schemaVersion: 2,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: {
      theme: 'light',
      language: initialLang,
      enableMiniWidget: false,
      enableAmbientLighting: true,
      enableGentleDecay: true,
      enableEcoProps: true,
      soundMaterial: 'classic',
      soundMuted: false,
      enableGyroscope: false,
      enableXRayInspection: false,
    },
    dayClaims: [],
    deletedDayClaims: [],
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
  updateSettings(patch: Partial<AppSettings>): void
  setTheme(t: Theme): void
  setLanguage(l: Language): void
  exportData(): string
  importData(json: string): boolean
}

export type AppStore = AppState & AppActions & { hydrated: boolean; saveError?: number; needsUpgrade?: boolean }

/** initPersistence 注入的立即落盘实现；未初始化时为空操作 */
let flushNowImpl: (() => void) | null = null
/** 最近一次落盘的 Promise（供退出握手等待在途写入完成） */
let lastSavePromise: Promise<void> = Promise.resolve()

/** 关键变更（打卡/撤销/领取/补卡/导入）绕过防抖立即写盘 */
function requestFlushNow(): void {
  flushNowImpl?.()
}

/** 强制立即落盘并等待写入完成（托盘退出握手等关键路径使用） */
export function forceFlush(): Promise<void> {
  flushNowImpl?.()
  return lastSavePromise
}

/** initPersistence 完成后 resolve；同步/自动同步需等待它避免与磁盘加载竞态 */
let resolvePersistenceReadyImpl: (() => void) | null = null
export const persistenceReady: Promise<void> = new Promise<void>((resolve) => {
  resolvePersistenceReadyImpl = resolve
})

/** 演示模式（?demo-castle）：由 main.tsx 在启动时标记并注入内存态，不读写本地存档 */
let demoMode = false
export function markDemoMode(): void {
  demoMode = true
}
export function isDemoMode(): boolean {
  return demoMode
}
export function applyDemoCastleState(): void {
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
}

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
      ...extra,
    }
    set((s) => ({ habits: [...s.habits, habit] }))
    return habit
  },

  updateHabit(id, patch) {
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === id ? { ...h, ...patch, updatedAt: new Date().toISOString() } : h,
      ),
    }))
    requestFlushNow()
  },

  archiveHabit(id) {
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === id && !h.archivedAt
          ? { ...h, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : h,
      ),
    }))
  },

  restoreHabit(id) {
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === id ? { ...h, archivedAt: undefined, updatedAt: new Date().toISOString() } : h,
      ),
    }))
  },

  deleteHabit(id) {
    const { habits, checkIns, builds, completedBlueprintIds, dayClaims } = get()
    const remainingCheckIns = checkIns.filter((c) => c.habitId !== id)
    const affectedBpIds = new Set(
      builds.filter((b) => b.fromHabitId === id).map((b) => b.blueprintId),
    )
    const nextBuilds = rebuildBuilds(liveCheckInsView(remainingCheckIns), dayClaims)
    const { completed: nextCompleted, showcase: nextShowcase } = reconcileCompletion(
      affectedBpIds,
      nextBuilds,
      completedBlueprintIds,
      get().showcasePlacements ?? [],
    )
    set({
      habits: habits.filter((h) => h.id !== id),
      checkIns: remainingCheckIns,
      builds: nextBuilds,
      completedBlueprintIds: nextCompleted,
      showcasePlacements: nextShowcase,
    })
    requestFlushNow()
  },

  togglePinHabit(id) {
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === id ? { ...h, pinned: !h.pinned, updatedAt: new Date().toISOString() } : h,
      ),
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
    }

    set({
      checkIns: [...checkIns, entry],
      builds: nextBuilds,
      completedBlueprintIds: nextCompleted,
      repairBricks: nextRepair,
      showcasePlacements: nextPlacements,
    })
    requestFlushNow()
    return { placed: slot ?? undefined, bonus: false, complete, checkInId: entry.id }
  },

  uncheckIn(habitId, day) {
    const { habits, checkIns, builds, dayClaims, completedBlueprintIds } = get()
    const targetDay = day ?? todayKey()
    const targetCheckIns = checkIns.filter((c) => !c.deletedAt && c.habitId === habitId && c.date === targetDay)
    if (targetCheckIns.length === 0) {
      return { ok: false, habitId, reason: 'no-checkin' }
    }

    const nowIso = new Date().toISOString()
    // 墓碑化打卡（不物理删除）：同步合并时删除胜出，防止撤销被并集复活
    const targetIds = new Set(targetCheckIns.map((c) => c.id))
    const nextCheckIns = checkIns.map((c) => (targetIds.has(c.id) ? { ...c, deletedAt: nowIso } : c))
    const removedBlockIds = new Set(
      targetCheckIns.map((c) => c.placedBlockId).filter((id): id is string => Boolean(id)),
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
        }
      }
    }

    // 事实层变更后统一重建积木投影（index 0..N-1 连续压实，多端一致）
    const nextBuilds = rebuildBuilds(liveCheckInsView(nextCheckIns), nextClaims)

    // 校验受影响蓝图的完成状态，退回未完成时同步移出展台
    const { completed: nextCompleted, showcase: nextShowcase } = reconcileCompletion(
      affectedBpIds,
      nextBuilds,
      completedBlueprintIds,
      get().showcasePlacements ?? [],
    )

    set({
      checkIns: nextCheckIns,
      builds: nextBuilds,
      completedBlueprintIds: nextCompleted,
      dayClaims: nextClaims,
      deletedDayClaims: nextDeletedClaims,
      showcasePlacements: nextShowcase,
    })
    requestFlushNow()

    return { ok: true, habitId, removedBlock }
  },

  useRepairBrick(habitId, date) {
    const { habits, checkIns, repairBricks } = get()
    const count = repairBricks ?? 0
    if (count <= 0) return { ok: false, reason: 'no-bricks' }
    const habit = habits.find((h) => h.id === habitId)
    if (!habit) return { ok: false, reason: 'no-habit' }
    if (habit.archivedAt) return { ok: false, reason: 'archived' }
    // 拒绝未来日期（补卡只应发生在过去）
    if (date > todayKey()) return { ok: false, reason: 'future' }
    if (checkIns.some((c) => !c.deletedAt && c.habitId === habitId && c.date === date)) {
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
    requestFlushNow()
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
          // 展台已满：跳过自动上展台（不阻塞落成）
          if (placement) nextPlacements = [...nextPlacements, placement]
        }
      }
    }

    const nextClaims: DayClaim[] = [
      ...dayClaims,
      { date: day, claimedAt: claimAt, blockId, blueprintId: activeBlueprintId },
    ]
    set({
      dayClaims: nextClaims,
      builds: nextBuilds,
      completedBlueprintIds: nextCompleted,
      repairBricks: nextRepair,
      showcasePlacements: nextPlacements,
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
    const {
      schemaVersion,
      habits,
      checkIns,
      builds,
      activeBlueprintId,
      completedBlueprintIds,
      settings,
      dayClaims,
      deletedDayClaims,
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
        deletedDayClaims,
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
      // prepareImport：v2 严格校验直通，v1 旧档迁移后校验，损坏/未来版本拒绝
      const prepared = prepareImport(parsed)
      if (!prepared) return false
      set({ ...prepared, hydrated: true, needsUpgrade: false, saveError: undefined })
      requestFlushNow()
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

  try {
    // 演示模式：main.tsx 已注入内存态（applyDemoCastleState），不读写本地存档
    if (isDemoMode()) return

    const res = await adapter.load()
    if (res.needsUpgrade) {
      // 存档来自更高版本的应用：挂起持久化（不注入 flush、不订阅保存），
      // 防止低版本会话把默认空态写回、覆盖高版本存档；UI 层提示升级。
      useAppStore.setState({ hydrated: true, needsUpgrade: true })
      return
    }
    const saved = res.state
    if (saved) {
      const lang = saved.settings.language ?? (typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh' : 'en')
      useAppStore.setState({ ...saved, settings: { ...saved.settings, language: lang }, hydrated: true })
    } else {
      useAppStore.setState({ hydrated: true })
    }
  } finally {
    resolvePersistenceReadyImpl?.()
  }

  let timer: number | undefined
  let pendingState: AppState | null = null

  function persistState(state: AppState): void {
    const {
      schemaVersion,
      habits,
      checkIns,
      builds,
      activeBlueprintId,
      completedBlueprintIds,
      settings,
      dayClaims,
      deletedDayClaims,
      repairBricks,
      showcasePlacements,
      foundationNotes,
    } = state
    // saveError 是运行时字段，不进持久化 schema
    lastSavePromise = adapter
      .save({
        schemaVersion,
        habits,
        checkIns,
        builds,
        activeBlueprintId,
        completedBlueprintIds,
        settings,
        dayClaims,
        deletedDayClaims,
        repairBricks,
        showcasePlacements,
        foundationNotes,
      })
      .then(() => {
        // 恢复成功后清除错误标记；该 setState 会再触发一次订阅，但输出相同、自然收敛
        if (useAppStore.getState().saveError !== undefined) {
          useAppStore.setState({ saveError: undefined })
        }
      })
      .catch(() => {
        // 首次失败才置位，避免"失败→订阅→再保存→再失败"的循环
        if (useAppStore.getState().saveError === undefined) {
          useAppStore.setState({ saveError: Date.now() })
        }
      })
  }

  function flushSave() {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    if (!pendingState) return
    const state = pendingState
    pendingState = null
    persistState(state)
  }
  flushNowImpl = flushSave

  useAppStore.subscribe((state) => {
    if (!state.hydrated) return
    pendingState = state
    clearTimeout(timer)
    timer = setTimeout(() => {
      flushSave()
    }, 150)
  })

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushSave)
    window.addEventListener('pagehide', flushSave)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushSave()
      }
    })
  }
}
