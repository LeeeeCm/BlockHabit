import { create } from 'zustand'

export interface TimerSession {
  startedAt: number
  targetMs: number
}

/**
 * 打卡倒计时会话（内存态，不持久化）：
 * 点击未完成卡片 → start；倒计时到点 → 卡片进入「待确认」；再次点击 → 真正打卡并 clear。
 */
interface TimerStore {
  sessions: Record<string, TimerSession>
  start(habitId: string, targetMs: number): void
  cancel(habitId: string): void
  clear(habitId: string): void
}

export const useTimerStore = create<TimerStore>()((set, get) => ({
  sessions: {},

  start(habitId, targetMs) {
    set((s) => ({ sessions: { ...s.sessions, [habitId]: { startedAt: Date.now(), targetMs } } }))
  },

  cancel(habitId) {
    set((s) => {
      const next = { ...s.sessions }
      delete next[habitId]
      return { sessions: next }
    })
  },

  clear(habitId) {
    get().cancel(habitId)
  },
}))
