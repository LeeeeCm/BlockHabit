/**
 * 系统通知统一出口：
 * - Tauri：走 notification 插件（WebView2 下 Web Notification 默认拒绝且异常被吞，
 *   插件链路在窗口隐藏/托盘态也能弹出；进程退出后仍不提醒——退出态调度见设计文档 backlog）
 * - 浏览器：回退 Web Notification（保持既有降级行为）
 * 权限惰性申请：首次真正要发通知时才请求，避免启动弹权限框打扰。
 */
export async function ensureNotifyPermission(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification')
      if (await isPermissionGranted()) return true
      const granted = await requestPermission()
      return granted === 'granted'
    }
    if (typeof Notification === 'undefined') return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    return (await Notification.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

export async function notify(title: string, body: string): Promise<void> {
  if (!(await ensureNotifyPermission())) return
  try {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      const { sendNotification } = await import('@tauri-apps/plugin-notification')
      sendNotification({ title, body })
      return
    }
    new Notification(title, { body })
  } catch {
    /* 通知失败静默降级为应用内提醒 */
  }
}
