import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
  style?: CSSProperties
  className?: string
}

/**
 * 一体化下拉选择（D-20261124-089；D-20261126-120 修掉拼接处的圆角）。
 *
 * 原生 <select> 在 Tauri/Windows 下由系统绘制展开层，和胶囊触发器完全脱节。
 * 这里用按钮 + 紧贴下方的列表，两者是**同一块积木**：
 * - 展开时触发器变成「上半块」：只保留上圆角、下方边框与圆角全部去掉；
 * - 列表是「下半块」：顶部无边框、无圆角、无缝隙，直接接着触发器的下沿；
 * - 阴影只挂在列表上（向下投），触发器不加阴影，避免在接缝处画出第二层轮廓。
 * 上一版触发器始终保持完整圆角，展开后列表又带自己的上边框与阴影，
 * 于是接缝处出现「圆角 + 尖角」互相顶撞的错位感。
 */
export function SelectMenu({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  style,
  className
}: Props) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  /** 展开补间：挂载后下一帧切到 1fr，让 grid-template-rows 产生高度过渡（D-20261128-134） */
  const [expanded, setExpanded] = useState(false)
  const selectedIndex = options.findIndex((opt) => opt.value === value)
  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0)

  useEffect(() => {
    if (!open) {
      setExpanded(false)
      return
    }
    const frame = requestAnimationFrame(() => setExpanded(true))
    return () => cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open) return
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, selectedIndex])

  function choose(index: number) {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!open) {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault()
        setOpen(true)
      }
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => Math.min(options.length - 1, prev + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) => Math.max(0, prev - 1))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(activeIndex)
    }
  }

  const selected = options.find((opt) => opt.value === value)

  return (
    <div
      ref={rootRef}
      className={className}
      style={{ position: 'relative', display: 'inline-flex', minWidth: 0, ...style }}
      onKeyDown={onKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-listbox` : undefined}
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          minWidth: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '5px 8px',
          fontSize: 'var(--fs-small)',
          // 展开时把下圆角与下边框收掉，和列表拼成同一块
          borderRadius: open ? 'var(--r-sm) var(--r-sm) 0 0' : 'var(--r-sm)',
          border: '1px solid var(--line)',
          borderBottom: open ? 'none' : '1px solid var(--line)',
          background: 'var(--surface)',
          color: 'var(--ink)',
          cursor: 'pointer',
          transition:
            'border-radius var(--dur-xs) var(--ease-default), border-color var(--dur-xs) var(--ease-default)'
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {selected?.label ?? placeholder ?? ''}
        </span>
        <svg
          aria-hidden="true"
          width="10"
          height="10"
          viewBox="0 0 16 16"
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform var(--dur-xs) var(--ease-out)'
          }}
        >
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <div
          className={`select-menu-panel${expanded ? ' is-open' : ''}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            zIndex: 30
          }}
        >
          <div className="select-menu-clip">
            <div
              id={`${id}-listbox`}
              role="listbox"
              aria-label={ariaLabel}
              style={{
                // 与触发器下沿严丝合缝：不再有 1px 重叠造成的双线
                marginTop: 0,
                maxHeight: 240,
                overflowY: 'auto',
                padding: 4,
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderTop: 'none',
                borderRadius: '0 0 var(--r-sm) var(--r-sm)'
              }}
            >
              {options.map((option, index) => {
                const isSelected = option.value === value
                const isActive = index === activeIndex
                return (
                  <button
                    key={option.value}
                    id={`${id}-option-${index}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(index)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '6px 8px',
                      border: 'none',
                      borderRadius: 6,
                      textAlign: 'left',
                      fontSize: 'var(--fs-small)',
                      color: 'var(--ink)',
                      background: isActive
                        ? 'color-mix(in srgb, var(--ink) 6%, transparent)'
                        : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {option.label}
                    </span>
                    {isSelected && (
                      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16">
                        <path
                          d="M3 8.5l3 3 7-7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
