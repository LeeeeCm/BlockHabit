import type { ReactNode } from 'react'

interface Props {
  title: string
  message: ReactNode
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

/** 确认弹窗：圆角卡片 + 危险操作确认（删除等） */
export function ConfirmDialog({ title, message, confirmLabel = '删除', onCancel, onConfirm }: Props) {
  return (
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
            style={{ background: 'var(--progress-green)', borderColor: 'var(--progress-green)' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
