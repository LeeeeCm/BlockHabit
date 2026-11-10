import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 瞬时提示（toast / 横幅）的计时器管理。
 *
 * 解决此前散落在 10 个组件里的两类真实问题：
 * 1. **重叠计时器**：连续弹两次提示时，第一次的 `setTimeout` 会把第二次的提示提前清掉
 *    （每次都是「先 setToast(msg) 再 setTimeout(() => setToast(null))」，没有取消上一笔）；
 * 2. **卸载泄漏**：组件卸载后计时器仍持有 setState 引用。
 *
 * 用法：
 * ```ts
 * const [toast, showToast] = useTransient<string>(2400)
 * showToast('已复制')          // 默认时长后自动消失
 * showToast('保留提示', 0)      // 0 = 不自动消失（保持常驻，直到下一次 show）
 * showToast(null)              // 立即清空
 * ```
 */
export function useTransient<T>(
  defaultMs: number
): [T | null, (value: T | null, durationMs?: number) => void] {
  const [value, setValue] = useState<T | null>(null)
  const timerRef = useRef<number | undefined>(undefined)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current)
      timerRef.current = undefined
    }
  }, [])

  const show = useCallback(
    (next: T | null, durationMs: number = defaultMs) => {
      clearTimer()
      setValue(next)
      if (next !== null && durationMs > 0) {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = undefined
          setValue(null)
        }, durationMs)
      }
    },
    [clearTimer, defaultMs]
  )

  useEffect(() => clearTimer, [clearTimer])

  return [value, show]
}
