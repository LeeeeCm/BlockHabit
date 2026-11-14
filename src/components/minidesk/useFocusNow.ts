import { useEffect, useState } from 'react'

/** 专注会话存在时的地与本位时钟（500ms 心跳，只驱动摆件自身的倒计时） */
export function useFocusNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [active])
  return now
}
