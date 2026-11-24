/**
 * 全局快捷键：唤起主窗并回到今日页（D-20261124-086）。
 *
 * 默认不注册；只有设置里显式开启才调用。非 Tauri 环境（浏览器预览 / 测试）直接降级。
 * 失败不抛错：调用方据此把设置回滚并提示，避免出现「开关开着但按了没反应」。
 */

export const QUICK_CHECKIN_SHORTCUT = 'CommandOrControl+Alt+H'

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function registerQuickCheckIn(handler: () => void | Promise<void>): Promise<boolean> {
  if (!isTauriRuntime()) return false
  try {
    const { register, unregister, isRegistered } =
      await import('@tauri-apps/plugin-global-shortcut')
    if (await isRegistered(QUICK_CHECKIN_SHORTCUT)) {
      await unregister(QUICK_CHECKIN_SHORTCUT)
    }
    await register(QUICK_CHECKIN_SHORTCUT, () => {
      void handler()
    })
    return true
  } catch {
    return false
  }
}

export async function unregisterQuickCheckIn(): Promise<void> {
  if (!isTauriRuntime()) return
  try {
    const { unregister, isRegistered } = await import('@tauri-apps/plugin-global-shortcut')
    if (await isRegistered(QUICK_CHECKIN_SHORTCUT)) {
      await unregister(QUICK_CHECKIN_SHORTCUT)
    }
  } catch {
    // 注销失败不影响退出；下次启动会重新注册
  }
}
