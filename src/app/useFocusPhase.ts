import { useEffect, useState } from 'react'
import { trayPhaseFor, type TrayFocusPhase } from '../logic/focusSession'
import { useTimerStore } from '../store/timerStore'

/**
 * 专注相位（摆件 / 托盘共用）：只有存在会话时才按 1s 心跳；
 * 相位判定抽到纯函数 trayPhaseFor（ready 优先于 focusing），
 * 返回值只在相位变化时改变，调用方可以把它放进 effect 依赖而不触发每秒副作用。
 */
export function useFocusPhase(): TrayFocusPhase {
  const sessions = useTimerStore((s) => s.sessions)
  const hasSession = Object.keys(sessions).length > 0
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!hasSession) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [hasSession])
  if (!hasSession) return null
  return trayPhaseFor(sessions, now)
}
