import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n'

interface Props {
  title: string
  message: ReactNode
  confirmLabel?: string
  confirmText?: string
  cancelLabel?: string
  cancelText?: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}
/**
 * 确认弹窗：与编辑弹窗同一套 overlay/dialog 结构。
 * 通过 portal 挂到 body——避免被卡片 hover 的 transform 变成包含块导致偏移，始终居中于窗口。
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  danger = true,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useI18n()
  const confirm = confirmText ?? confirmLabel ?? (danger ? t.common.delete : t.common.confirm)
  const cancel = cancelText ?? cancelLabel ?? t.common.cancel
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()} style={{ width: 380, maxWidth: '92vw' }}>
        <div className="dialog-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onCancel} title={t.common.close}>
            ✕
          </button>
        </div>
        <div className="dialog-body" style={{ padding: '20px 24px' }}>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6 }}>{message}</p>
        </div>
        <div className="dialog-footer">
          <button className="btn ghost" onClick={onCancel}>
            {cancel}
          </button>
          <button
            className="btn primary"
            style={
              danger
                ? { background: 'var(--danger)', borderColor: 'var(--danger)', color: 'var(--danger-ink)' }
                : undefined
            }
            onClick={onConfirm}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
