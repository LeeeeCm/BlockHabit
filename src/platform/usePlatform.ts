import { useState, useEffect } from 'react'
import { triggerHaptic, type HapticType } from './haptics'
import { detectPlatform, type PlatformType } from './index'

export interface UsePlatformResult {
  platform: PlatformType
  isMobile: boolean
  isDesktop: boolean
  haptic: (type?: HapticType) => void
}

export function usePlatform(): UsePlatformResult {
  const [platform, setPlatform] = useState<PlatformType>(() => detectPlatform())

  useEffect(() => {
    function handleResize() {
      setPlatform(detectPlatform())
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return {
    platform,
    isMobile: platform === 'mobile',
    isDesktop: platform === 'desktop',
    haptic: (type: HapticType = 'light') => triggerHaptic(type),
  }
}
