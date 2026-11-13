import { describe, it, expect, vi } from 'vitest'
import { initPersistence, useAppStore } from './appStore'
import type { StorageAdapter } from '../storage/adapter'

/**
 * 独立文件：initPersistence 是模块级单例（persistenceStarted），
 * 每个需要它的用例文件只能初始化一次。
 */
describe('persistence flush timing', () => {
  it('key actions persist immediately; light actions go through 150ms debounce', async () => {
    vi.useFakeTimers()
    try {
      const saveSpy = vi.fn(() => Promise.resolve())
      const adapter: StorageAdapter = {
        load: async () => ({ state: null }),
        save: saveSpy
      }
      await initPersistence(adapter)
      useAppStore.setState({ hydrated: true })

      const habit = useAppStore.getState().addHabit('读书', { type: 'daily' })
      // 打卡是关键变更：订阅后同步 flush，不等待防抖窗口
      useAppStore.getState().checkIn(habit.id)
      expect(saveSpy).toHaveBeenCalledTimes(1)

      // 置顶是轻量变更：走 150ms 防抖
      useAppStore.getState().togglePinHabit(habit.id)
      expect(saveSpy).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(200)
      expect(saveSpy).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
