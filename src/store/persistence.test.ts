import { describe, it, expect, vi } from 'vitest'
import { initPersistence, useAppStore } from './appStore'
import type { StorageAdapter } from '../storage/adapter'
import type { AppState } from '../types'

describe('persistence save-failure surfacing', () => {
  it('sets saveError when adapter.save rejects and clears after success', async () => {
    let fail = true
    const saved: AppState[] = []
    const adapter: StorageAdapter = {
      load: async () => ({ state: null }),
      save: (s) => {
        if (fail) return Promise.reject(new Error('disk full'))
        saved.push(s)
        return Promise.resolve()
      },
    }
    await initPersistence(adapter)
    useAppStore.setState({ hydrated: true })

    // 关键 action（checkIn）绕过防抖立即落盘
    const habit = useAppStore.getState().addHabit('读书', { type: 'daily' })
    useAppStore.getState().checkIn(habit.id)
    await vi.waitFor(() => {
      expect(useAppStore.getState().saveError).toBeDefined()
    })

    // 磁盘恢复后下一次保存成功 → saveError 清除
    fail = false
    useAppStore.getState().togglePinHabit(habit.id)
    await vi.waitFor(() => {
      expect(useAppStore.getState().saveError).toBeUndefined()
      expect(saved.length).toBeGreaterThan(0)
    })
  })
})
