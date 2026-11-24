import { useState } from 'react'
import type { ReactNode } from 'react'
import { IconChevronDown } from '../Icons'

/**
 * D4：设置分组容器。
 * 设置项从 19 个控件 / 3.6 屏收敛为「首屏三组 + 折叠的进阶组」：
 * collapsible 时标题行可点击（并支持 Enter / Space），展开态记在本地 state，不影响任何已保存设置。
 */
export function Group({
  title,
  children,
  collapsible = false,
  defaultOpen = true
}: {
  title: string
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="apple-group">
      <div
        className="apple-group-title"
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? open : undefined}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setOpen((v) => !v)
                }
              }
            : undefined
        }
        style={
          collapsible
            ? {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none'
              }
            : undefined
        }
      >
        <span>{title}</span>
        {collapsible && (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ink-2)',
              transition: 'transform var(--dur-sm) var(--ease-out)',
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)'
            }}
          >
            <IconChevronDown size={15} />
          </span>
        )}
      </div>
      {open && (collapsible ? <div className="apple-group-body">{children}</div> : children)}
    </div>
  )
}
