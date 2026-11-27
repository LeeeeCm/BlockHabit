import { useEffect, useRef, useState, type ReactNode } from 'react'
import { prefersReducedMotion } from '../platform/dom'

/** 收起动画时长：与 --dur-md（220ms）对齐，留 20ms 余量给 transitionend 缺失时的卸载回退 */
const COLLAPSE_FALLBACK_MS = 240

interface Props {
  open: boolean
  children: ReactNode
  className?: string
  /** 内容层附加类名（例如设置分组需要保留 flex gap 间距） */
  contentClassName?: string
}

/**
 * 展开 / 收拢过渡容器（D-20261127-126）：
 * - 展开：先以 0fr 挂载一帧，再过渡到 1fr（高度补间由浏览器完成，内容高度变化自然跟随）；
 * - 收起：先过渡到 0fr，动画结束后才卸载子内容——保留原有「收起分组不挂载面板」的惰性语义；
 * - 关闭期间 aria-hidden + inert，键盘焦点不会落进不可见内容；
 * - prefers-reduced-motion 为真时跳过动画、立即挂载/卸载。
 */
export function Collapse({ open, children, className, contentClassName }: Props) {
  const [rendered, setRendered] = useState(open)
  const [expanded, setExpanded] = useState(open)
  const timerRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const reduced = prefersReducedMotion()
    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
    const clearFrame = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }

    if (open) {
      clearTimer()
      setRendered(true)
      if (reduced) {
        clearFrame()
        setExpanded(true)
        return
      }
      // 已展开（例如快速重开）时不重播动画
      if (expanded) return
      clearFrame()
      // 先让 0fr 挂载一帧，再切到 1fr，浏览器才会产生过渡
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null
        setExpanded(true)
      })
      return () => clearFrame()
    }

    clearFrame()
    setExpanded(false)
    if (!rendered) return
    if (reduced) {
      setRendered(false)
      return
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setRendered(false)
    }, COLLAPSE_FALLBACK_MS)
    return () => clearTimer()
  }, [open, rendered, expanded])

  if (!rendered) return null

  return (
    <div
      className={className ? `collapse ${className}` : 'collapse'}
      data-open={expanded ? 'true' : 'false'}
      aria-hidden={!open}
      inert={!open}
    >
      <div className={contentClassName ? `collapse-inner ${contentClassName}` : 'collapse-inner'}>
        {children}
      </div>
    </div>
  )
}
