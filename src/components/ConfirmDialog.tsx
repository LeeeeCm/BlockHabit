import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  title: string
  message: ReactNode
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

/**
 * 确认弹窗：与编辑弹窗同一套 overlay/dialog 结构。
 * 通过 portal 挂到 body——避免被卡片 hover 的 transform 变成包含块导致偏移，始终居中于窗口。
 */
export function ConfirmDialog({ title, message, confirmLabel = '删除', onCancel, onConfirm }: Props) {
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()} style={{ minWidth: 320 }}>
        <h3>{title}</h3>
        <p style={{ margin: '0 0 4px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.7 }}>{message}</p>
        <div className="dialog-actions">
          <button className="btn ghost" onClick={onCancel}>
            取消
          </button>
          <button
            className="btn primary"
            style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: 'var(--danger-ink)' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
