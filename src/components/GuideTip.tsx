import { useEffect, useRef } from 'react'

export interface GuideTipProps {
  title: string
  body: string
  dismissLabel: string
  variant?: 'fixed' | 'inline'
  onDismiss: () => void
}

/**
 * 页面提示卡（D-20261110-054）：首次进入某页时给一条可关闭的用法提示。
 *
 * - 只用现有令牌：--surface / --line / --r-md / --fs-body / --fs-small，不引入新色相与新阴影；
 * - role="note"，不抢焦点、不 trap、不自动消失；Esc 关闭；
 * - 无动画（默认与 prefers-reduced-motion 下都不动），符合 A5「动效克制」。
 *
 * 固定态：左下角浮起（bottom 84 避开高 64px 的 tabbar，zIndex 60 低于弹窗）。
 * 内联态：常规文档流，供统计页放在页头与热图之间。
 */
export function GuideTip({
  title,
  body,
  dismissLabel,
  variant = 'fixed',
  onDismiss
}: GuideTipProps) {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // 弹窗打开时 Esc 属于弹窗：避免一次按键同时关掉弹窗与提示
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      onDismissRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const fixed = variant === 'fixed'
  return (
    <div
      role="note"
      style={{
        position: fixed ? 'fixed' : 'static',
        left: fixed ? 20 : undefined,
        bottom: fixed ? 84 : undefined,
        maxWidth: fixed ? 320 : undefined,
        zIndex: fixed ? 60 : undefined,
        margin: fixed ? 0 : '12px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: '12px 14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        pointerEvents: 'auto'
      }}
    >
      <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--ink)' }}>
        {title}
      </div>
      <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)', lineHeight: 1.6 }}>
        {body}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn ghost"
          onClick={onDismiss}
          style={{ padding: '3px 12px', fontSize: 'var(--fs-small)', borderRadius: 999 }}
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  )
}
