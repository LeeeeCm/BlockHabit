export type HapticType = 'light' | 'medium' | 'heavy' | 'success'

export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return
  }
  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10)
        break
      case 'medium':
        navigator.vibrate(25)
        break
      case 'heavy':
        navigator.vibrate(45)
        break
      case 'success':
        navigator.vibrate([15, 50, 20])
        break
    }
  } catch {
    // 忽略特定平台对 vibrate 调用的安全限制
  }
}
