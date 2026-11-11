import { describe, it, expect, vi } from 'vitest'
import { initPersistence, useAppStore } from './appStore'
import type { StorageAdapter } from '../storage/adapter'

/**
 * A1 回归：读档失败 ≠ 没有存档。
 * 独立文件：initPersistence 是模块级单例，每个用例文件只能初始化一次。
 */
describe('persistence suspension when archive read fails', () => {
  it('读档失败时挂起持久化，任何变更都不得触达磁盘', async () => {
    const saveSpy = vi.fn(() => Promise.resolve())
    const adapter: StorageAdapter = {
      load: async () => ({ state: null, loadFailed: true, detail: 'EBUSY' }),
      save: saveSpy,
    }
    await initPersistence(adapter)
    useAppStore.setState({ hydrated: true })

    expect(useAppStore.getState().loadFailed).toBe(true)

    const habit = useAppStore.getState().addHabit('不该被写进磁盘的习惯', { type: 'daily' })
    useAppStore.getState().checkIn(habit.id)
    // 关键动作本应立刻落盘；挂起态必须零写入，否则空态会覆盖真实存档
    await new Promise((r) => setTimeout(r, 30))
    expect(saveSpy).not.toHaveBeenCalled()
  })
})
