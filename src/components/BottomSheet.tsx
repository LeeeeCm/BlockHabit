import React, { useEffect } from 'react'
import { triggerHaptic } from '../platform'
let sheetLockCount = 0
let originalBodyOverflow = ''

function lockBodyScroll() {
  if (sheetLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  sheetLockCount++
}

function unlockBodyScroll() {
  sheetLockCount = Math.max(0, sheetLockCount - 1)
  if (sheetLockCount === 0) {
    document.body.style.overflow = originalBodyOverflow
  }
}

export function _resetSheetLockCountForTest() {
  sheetLockCount = 0
  originalBodyOverflow = ''
}
export interface BottomSheetProps {
  open?: boolean
  isOpen?: boolean
  onClose: () => void
  title?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  maxHeight?: string | number
  className?: string
  contentStyle?: React.CSSProperties
}

export function BottomSheet({
  open,
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxHeight = '85vh',
  className,
  contentStyle,
}: BottomSheetProps) {
  const isSheetOpen = open ?? isOpen ?? true

  useEffect(() => {
    if (!isSheetOpen) return

    triggerHaptic('light')
    lockBodyScroll()

    return () => {
      unlockBodyScroll()
    }
  }, [isSheetOpen])

  useEffect(() => {
    if (!isSheetOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSheetOpen, onClose])

  if (!isSheetOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title != null ? 'bottom-sheet-title' : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* 半透明遮罩与毛玻璃背景 */}
      <div
        data-testid="bottom-sheet-backdrop"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* 底部抽屉面板 */}
      <div
        className={className}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 1,
          background: 'var(--surface)',
          color: 'var(--ink)',
          borderTopLeftRadius: 'var(--r-lg, 20px)',
          borderTopRightRadius: 'var(--r-lg, 20px)',
          borderTop: '1px solid var(--line)',
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.16)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
      >
        {/* 顶部手势拖拽把手 */}
        <div
          data-testid="bottom-sheet-handle"
          role="button"
          tabIndex={0}
          aria-label="Dismiss sheet"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onClose()
            }
          }}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '10px 0 6px',
            cursor: 'pointer',
            touchAction: 'none',
            width: '100%',
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: 'color-mix(in srgb, var(--ink) 25%, transparent)',
            }}
          />
        </div>

        {/* 标题栏 */}
        {title != null && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 20px 10px',
              borderBottom: '1px solid var(--line)',
              flexShrink: 0,
            }}
          >
            <h3
              id="bottom-sheet-title"
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </h3>
            <button
              data-testid="bottom-sheet-close"
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'color-mix(in srgb, var(--ink) 6%, transparent)',
                border: 'none',
                color: 'var(--ink-2)',
                fontSize: 14,
                width: 30,
                height: 30,
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* 内容区 */}
        <div
          style={{
            padding: '16px 20px',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            flex: 1,
            minHeight: 0,
            ...contentStyle,
          }}
        >
          {children}
        </div>

        {/* 底部操作区 */}
        {footer && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--line)',
              background: 'var(--surface)',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
