import { useEffect, useState } from 'react'
import { todayKey } from './dates'

/**
 * 响应式"今天"：10s 轮询 + 窗口聚焦/可见性变化时刷新。
 * 统一驱动跨午夜翻转（托盘 tooltip、红点、统计页此前各自取值会停留昨天）。
 */
export function useTodayKey(): string {
  const [day, setDay] = useState(todayKey())
  useEffect(() => {
    const tick = () => {
      const next = todayKey()
      setDay((prev) => (prev === next ? prev : next))
    }
    const timer = setInterval(tick, 10_000)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return day
}
