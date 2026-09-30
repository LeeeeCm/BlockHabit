import { describe, it, expect, vi } from 'vitest'
import { initPersistence, useAppStore } from './appStore'
import type { StorageAdapter } from '../storage/adapter'

/**
 * 独立文件：initPersistence 是模块级单例（persistenceStarted），
 * 每个需要它的用例文件只能初始化一次。
 */
describe('persistence suspension on newer-version archive', () => {
  it('suspends persistence when archive comes from a newer app version', async () => {
    const saveSpy = vi.fn(() => Promise.resolve())
    const adapter: StorageAdapter = {
      load: async () => ({ state: null, needsUpgrade: true }),
      save: saveSpy,
    }
    await initPersistence(adapter)
    useAppStore.setState({ hydrated: true })

    const habit = useAppStore.getState().addHabit('会被丢弃的习惯', { type: 'daily' })
    useAppStore.getState().checkIn(habit.id)
    // 挂起态：任何变更都不得触达磁盘，防止低版本覆盖高版本存档
    expect(useAppStore.getState().needsUpgrade).toBe(true)
    await new Promise((r) => setTimeout(r, 20))
    expect(saveSpy).not.toHaveBeenCalled()
  })
})
