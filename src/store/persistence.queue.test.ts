import { describe, it, expect, vi } from 'vitest'
import { initPersistence, useAppStore } from './appStore'
import type { StorageAdapter } from '../storage/adapter'

/**
 * A2 回归：写盘必须串行。
 * 旧实现用 lastSavePromise 覆盖赋值，两笔写可同时在途并共用固定 .tmp 名 → 可能写出半截 JSON。
 * 独立文件：initPersistence 是模块级单例，每个用例文件只能初始化一次。
 */
describe('persistence save serialization', () => {
  it('上一笔未落地时，下一笔排队而不是并发开始', async () => {
    let calls = 0
    const pending: Array<() => void> = []
    const adapter: StorageAdapter = {
      load: async () => ({ state: null }),
      save: () => {
        calls++
        return new Promise<void>((resolve) => {
          pending.push(resolve)
        })
      }
    }
    await initPersistence(adapter)
    useAppStore.setState({ hydrated: true })

    const a = useAppStore.getState().addHabit('读书', { type: 'daily' })
    const b = useAppStore.getState().addHabit('跑步', { type: 'daily' })

    useAppStore.getState().checkIn(a.id)
    expect(calls).toBe(1)
    useAppStore.getState().checkIn(b.id)
    // 第一笔仍未落地：第二笔必须排队，不能并发起第二笔写
    expect(calls).toBe(1)

    pending[0]?.()
    await vi.waitFor(() => expect(calls).toBe(2))

    pending[1]?.()
    await vi.waitFor(() => expect(useAppStore.getState().saveError).toBeUndefined())
  })
})
