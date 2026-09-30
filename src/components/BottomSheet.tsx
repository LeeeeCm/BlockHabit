import React, { useEffect } from 'react'
import { triggerHaptic } from '../platform'
import { lockBodyScroll, unlockBodyScroll, _resetBodyScrollLockForTest } from '../platform/dom'
import { useI18n } from '../i18n'
import { IconClose } from './Icons'

export function _resetSheetLockCountForTest() {
  _resetBodyScrollLockForTest()
}
export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  maxHeight?: string | number
  className?: string
  contentStyle?: React.CSSProperties
  /** 嵌套场景：子弹窗（如导入确认框）打开时传 false 抑制本抽屉的 Esc 关闭 */
  escEnabled?: boolean
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  maxHeight = '85vh',
  className,
  contentStyle,
  escEnabled = true,
}: BottomSheetProps) {
  const { t } = useI18n()
  const isSheetOpen = open
  const [dragY, setDragY] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const dragStartYRef = React.useRef(0)
  const currentDragYRef = React.useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartYRef.current = e.touches[0].clientY
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const dy = Math.max(0, e.touches[0].clientY - dragStartYRef.current)
    currentDragYRef.current = dy
    setDragY(dy)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    if (currentDragYRef.current > 75) {
      triggerHaptic('light')
      onClose()
    }
    setDragY(0)
    currentDragYRef.current = 0
  }

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
      if (e.key === 'Escape' && escEnabled) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSheetOpen, onClose, escEnabled])

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
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
          overflow: 'hidden',
        }}
      >
        {/* 顶部手势拖拽把手 */}
        <div
          data-testid="bottom-sheet-handle"
          role="button"
          tabIndex={0}
          aria-label={t.common.dismiss}
          onClick={onClose}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
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
              height: 4.5,
              borderRadius: 3,
              background: 'color-mix(in srgb, var(--ink) 25%, transparent)',
            }}
          />
        </div>

        {/* 标题栏（支持向下滑动手势） */}
        {title != null && (
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 20px 10px',
              borderBottom: '1px solid var(--line)',
              flexShrink: 0,
              touchAction: 'none',
            }}
          >
            <h3
              id="bottom-sheet-title"
              style={{
                flex: 1,
                minWidth: 0,
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
              aria-label={t.common.close}
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
              <IconClose size={16} />
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
