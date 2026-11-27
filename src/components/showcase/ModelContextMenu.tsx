import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TranslationSchema } from '../../i18n'
import { IconRotateCw, IconShowcase } from '../Icons'

interface Props {
  x: number
  y: number
  blueprintName: string
  t: TranslationSchema
  onRotate: () => void
  onTuck: () => void
  onClose: () => void
}

const EDGE = 8

/**
 * 展台建筑右键 / 长按菜单（D-20261127-127）：
 * 旋转 90° 或收拢回堆场；点击外部、Esc、滚动或窗口变化即关闭。
 * 通过 portal 挂到 body 并用真实 rect 夹取视口，避免被画布的 overflow:hidden 裁切。
 */
export function ModelContextMenu({ x, y, blueprintName, t, onRotate, onTuck, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const rotateRef = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const rect = menuRef.current?.getBoundingClientRect()
    const width = rect?.width ?? 184
    const height = rect?.height ?? 118
    const maxLeft = Math.max(EDGE, window.innerWidth - width - EDGE)
    const maxTop = Math.max(EDGE, window.innerHeight - height - EDGE)
    setPosition({
      left: Math.min(Math.max(EDGE, x), maxLeft),
      top: Math.min(Math.max(EDGE, y), maxTop)
    })
  }, [x, y])

  useEffect(() => {
    rotateRef.current?.focus()
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    const onDismiss = () => onClose()
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', onDismiss)
    window.addEventListener('scroll', onDismiss, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', onDismiss)
      window.removeEventListener('scroll', onDismiss, true)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={menuRef}
      className="sc-ctx"
      role="menu"
      aria-label={blueprintName}
      style={{ left: position.left, top: position.top }}
    >
      <div className="sc-ctx-title">{blueprintName}</div>
      <button
        ref={rotateRef}
        type="button"
        role="menuitem"
        className="sc-ctx-item"
        onClick={onRotate}
      >
        <IconRotateCw size={14} />
        <span>{t.showcase.contextRotate}</span>
      </button>
      <button type="button" role="menuitem" className="sc-ctx-item" onClick={onTuck}>
        <IconShowcase size={14} />
        <span>{t.showcase.contextTuck}</span>
      </button>
    </div>,
    document.body
  )
}
