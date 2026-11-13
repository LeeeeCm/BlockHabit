export type PlatformType = 'mobile' | 'desktop'

export function detectPlatform(): PlatformType {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'desktop'
  }

  const isIPad = /macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1

  const inTauriMobile =
    '__TAURI_INTERNALS__' in window &&
    (/iphone|ipad|ipod|android/i.test(navigator.userAgent) || isIPad)

  // 粗指针（手指/触笔）才算移动交互范式；触屏笔记本（fine pointer）缩窄窗口仍归桌面，
  // 避免带触屏的 Windows 设备拖窄窗口时整个应用切换到移动布局
  const coarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches

  const isNarrowTouch =
    window.innerWidth <= 768 &&
    coarsePointer &&
    (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)

  return inTauriMobile || isNarrowTouch ? 'mobile' : 'desktop'
}
