import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  QUICK_CHECKIN_SHORTCUT,
  registerQuickCheckIn,
  unregisterQuickCheckIn
} from './globalShortcut'

const plugin = vi.hoisted(() => ({
  register: vi.fn(async () => undefined),
  unregister: vi.fn(async () => undefined),
  isRegistered: vi.fn(async () => false)
}))

vi.mock('@tauri-apps/plugin-global-shortcut', () => plugin)

afterEach(() => {
  vi.clearAllMocks()
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
})

describe('globalShortcut（D-20261124-086）', () => {
  it('非 Tauri 环境直接降级，不调用插件', async () => {
    expect(await registerQuickCheckIn(vi.fn())).toBe(false)
    expect(plugin.register).not.toHaveBeenCalled()
  })

  it('已注册时先注销再注册，并转发回调', async () => {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    plugin.isRegistered.mockResolvedValueOnce(true)
    const handler = vi.fn()
    expect(await registerQuickCheckIn(handler)).toBe(true)
    expect(plugin.unregister).toHaveBeenCalledWith(QUICK_CHECKIN_SHORTCUT)
    expect(plugin.register).toHaveBeenCalledWith(QUICK_CHECKIN_SHORTCUT, expect.any(Function))
    const calls = plugin.register.mock.calls as unknown as Array<[string, () => void]>
    calls[0]?.[1]?.()
    expect(handler).toHaveBeenCalled()
  })

  it('插件注册失败时返回 false，不抛出', async () => {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    plugin.register.mockRejectedValueOnce(new Error('conflict'))
    expect(await registerQuickCheckIn(vi.fn())).toBe(false)
  })

  it('注销只在已注册时调用', async () => {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    plugin.isRegistered.mockResolvedValueOnce(false)
    await unregisterQuickCheckIn()
    expect(plugin.unregister).not.toHaveBeenCalled()
  })
})
