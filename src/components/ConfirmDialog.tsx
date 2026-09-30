import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n'
import { IconClose } from './Icons'
import { triggerHaptic, usePlatform } from '../platform'
import { useDialogA11y } from './useDialogA11y'
import { BottomSheet } from './BottomSheet'

interface Props {
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
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
  cancelLabel,
  danger = true,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useI18n()
  const { isMobile } = usePlatform()
  const { ref: dialogRef } = useDialogA11y({ open: true, onClose: onCancel, enabled: !isMobile })
  const confirm = confirmLabel ?? (danger ? t.common.delete : t.common.confirm)
  const cancel = cancelLabel ?? t.common.cancel

  if (isMobile) {
    const footerContent = (
      <div style={{ display: 'flex', gap: 10, width: '100%' }}>
        <button className="btn ghost" onClick={onCancel} style={{ flex: 1 }}>
          {cancel}
        </button>
        <button
          className="btn primary"
          style={{
            flex: 1,
            ...(danger
              ? { background: 'var(--danger)', borderColor: 'var(--danger)', color: 'var(--danger-ink)' }
              : undefined),
          }}
          onClick={onConfirm}
        >
          {confirm}
        </button>
      </div>
    )
    return (
      <BottomSheet open={true} onClose={onCancel} title={title} footer={footerContent}>
        <div style={{ padding: '8px 0 16px', fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>
          {message}
        </div>
      </BottomSheet>
    )
  }

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="dialog"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: 380, maxWidth: '92vw' }}
      >
        <div className="dialog-header">
          <h3>{title}</h3>
          <button
            className="icon-btn"
            onClick={() => {
              triggerHaptic('light')
              onCancel()
            }}
            title={t.common.close}
          >
            <IconClose size={18} />
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
