import { HapticType, triggerHaptic } from './haptics'
import { usePlatform, type UsePlatformResult } from './usePlatform'

export type PlatformType = 'mobile' | 'desktop'

export function detectPlatform(): PlatformType {
  if (typeof window === 'undefined') return 'desktop'

  const inTauriMobile =
    '__TAURI_INTERNALS__' in window &&
    /iphone|ipad|ipod|android/i.test(navigator.userAgent)

  const isNarrowTouch =
    window.innerWidth <= 768 &&
    (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)

  return inTauriMobile || isNarrowTouch ? 'mobile' : 'desktop'
}

export { triggerHaptic, type HapticType, usePlatform, type UsePlatformResult }
