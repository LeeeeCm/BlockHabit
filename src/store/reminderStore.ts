import { create } from 'zustand'
import { MAX_SNOOZES, type ReminderStage, type ReminderTrack } from '../logic/reminderScheduler'

/** 待处理提醒条目（弹窗/横幅/托盘共用） */
export interface PendingReminder {
  habitId: string
  /** 触发时刻的习惯名快照（习惯改名后弹窗仍能对上当次触发） */
  name: string
  stage: ReminderStage
  /** "HH:mm" 开始时刻 */
  start: string
  /** "HH:mm" 截止时刻（选填） */
  end?: string
  firedAt: number
}

/**
 * 提醒会话态（内存态，不持久化）：
 * tracks 是调度器的去重轨迹（按天重置）；pending 是待展示队列，
 * 窗口隐藏时先入队，回窗后由 ReminderDialog 呈现（合并列表，避免连环打断）。
 */
interface ReminderStore {
  tracks: Record<string, ReminderTrack>
  pending: PendingReminder[]
  /** 用户已主动关掉弹窗：待办仍留在 Today 横幅里，点击横幅可重新打开 */
  suppressed: boolean
  setTrack(habitId: string, track: ReminderTrack): void
  push(item: PendingReminder): void
  dismiss(habitId: string): void
  /** 关掉弹窗但保留待办（横幅继续可见） */
  acknowledge(): void
  /** 从横幅重新打开弹窗 */
  reopen(): void
  /** 请求贪睡：到期时刻入轨迹并计数；超上限返回 false */
  snooze(habitId: string, untilMs: number): boolean
  clearAll(): void
}

export const useReminderStore = create<ReminderStore>()((set, get) => ({
  tracks: {},
  pending: [],
  suppressed: false,

  setTrack(habitId, track) {
    set((s) => ({ tracks: { ...s.tracks, [habitId]: track } }))
  },

  push(item) {
    set((s) => {
      if (s.pending.some((p) => p.habitId === item.habitId)) return s
      return { pending: [...s.pending, item], suppressed: false }
    })
  },

  dismiss(habitId) {
    set((s) => ({ pending: s.pending.filter((p) => p.habitId !== habitId) }))
  },

  acknowledge() {
    set({ suppressed: true })
  },

  reopen() {
    set({ suppressed: false })
  },

  snooze(habitId, untilMs) {
    const track = get().tracks[habitId]
    if (!track || track.snoozeCount >= MAX_SNOOZES) return false
    set((s) => ({
      tracks: {
        ...s.tracks,
        [habitId]: { ...track, snoozeUntilMs: untilMs, snoozeCount: track.snoozeCount + 1 },
      },
    }))
    return true
  },

  clearAll() {
    set({ pending: [] })
  },
}))
