export type PlatformType = 'mobile' | 'desktop'

export function detectPlatform(): PlatformType {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'desktop'
  }

  const isIPad =
    /macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1

  const inTauriMobile =
    '__TAURI_INTERNALS__' in window &&
    (/iphone|ipad|ipod|android/i.test(navigator.userAgent) || isIPad)

  const isNarrowTouch =
    window.innerWidth <= 768 &&
    (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)

  return inTauriMobile || isNarrowTouch ? 'mobile' : 'desktop'
}
