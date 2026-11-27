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
  /**
   * 层级：用于「弹窗里再开弹窗」的场景（如掉落弹窗内打开心境弹窗）。
   * 父层 100（.drop-overlay）之上必须至少 101，否则会渲染在父弹窗背面。
   * 缺省 0 = 沿用样式表里的 .overlay 层级（z-index 50），不影响既有弹窗。
   */
  layer?: number
}

/**
 * 统一弹窗无障碍行为：
 * - Esc 关闭；
 * - Tab/Shift+Tab 焦点圈闭（面板内首尾循环）；
 * - 打开时聚焦面板或 initialFocusRef，关闭后恢复先前焦点。
 * 配合面板元素上的 role="dialog" / aria-modal="true" 使用（ref 挂在面板容器上）。
 */
export function useDialogA11y(opts: DialogA11yOptions): {
  ref: React.RefObject<HTMLDivElement | null>
  /** 直接铺在弹窗根节点的 style：需要叠层时把 z-index 抬到父弹窗之上 */
  style: React.CSSProperties | undefined
} {
  const ref = useRef<HTMLDivElement | null>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(opts.onClose)
  onCloseRef.current = opts.onClose
  const { open, initialFocusRef, enabled = true, layer = 0 } = opts

  useEffect(() => {
    if (!open || !enabled) return
    const panel = ref.current
    if (!panel) return

    // 打开前的焦点（仅当它在面板外才需要恢复）：关闭时若焦回一个已卸载元素无意义
    const active = document.activeElement as HTMLElement | null
    const activeInside = active instanceof Node && panel.contains(active)
    prevFocusRef.current = active && !activeInside ? active : null

    // C6：React 的 autoFocus 在 commit 阶段已把焦点放到面板内的输入框上，
    // 此处不能再把焦点抢回面板容器（否则 Ctrl+N 新建习惯后光标不在名称输入框里）。
    const initial = initialFocusRef?.current ?? (activeInside ? (active as HTMLElement) : panel)
    initial.focus?.()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
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

  return { ref, style: layer ? { zIndex: layer } : undefined }
}
