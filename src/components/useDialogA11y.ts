import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface DialogA11yOptions {
  open: boolean
  onClose: () => void
  /** 打开时优先聚焦的元素（如输入框）；缺省聚焦面板容器 */
  initialFocusRef?: React.RefObject<HTMLElement | null>
  /** 嵌套场景：子弹窗打开时父弹窗传 false 抑制自己的 Esc/焦点管理 */
  enabled?: boolean
}

/**
 * 统一弹窗无障碍行为：
 * - Esc 关闭；
 * - Tab/Shift+Tab 焦点圈闭（面板内首尾循环）；
 * - 打开时聚焦面板或 initialFocusRef，关闭后恢复先前焦点。
 * 配合面板元素上的 role="dialog" / aria-modal="true" 使用（ref 挂在面板容器上）。
 */
export function useDialogA11y(opts: DialogA11yOptions): { ref: React.RefObject<HTMLDivElement | null> } {
  const ref = useRef<HTMLDivElement | null>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(opts.onClose)
  onCloseRef.current = opts.onClose
  const { open, initialFocusRef, enabled = true } = opts

  useEffect(() => {
    if (!open || !enabled) return
    const panel = ref.current
    if (!panel) return

    prevFocusRef.current = document.activeElement as HTMLElement | null
    const initial = initialFocusRef?.current ?? panel
    initial.focus?.()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
      )
      if (focusables.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      const inside = active instanceof Node && panel.contains(active)
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      prevFocusRef.current?.focus?.()
    }
  }, [open, enabled, initialFocusRef])

  return { ref }
}
