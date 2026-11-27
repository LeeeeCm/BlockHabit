import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'

interface Props {
  side: 'left' | 'right'
  /** 竖向标签文字（沙盘 / 堆场） */
  label: string
  open: boolean
  count?: number
  onToggle: () => void
  expandLabel: string
  collapseLabel: string
  children: ReactNode
}

/**
 * 展台左右抽屉（D-20261127-127）：
 * 44px 竖向标签常驻；面板用 grid-template-columns 0fr→1fr 滑出（--dur-lg / --ease-standard），
 * 内容同步淡入。关闭时整块 inert，键盘焦点不会进入被裁掉的列表。
 */
export function ShowcaseDrawer({
  side,
  label,
  open,
  count,
  onToggle,
  expandLabel,
  collapseLabel,
  children
}: Props) {
  const panelId = useId()
  // 首次展开后才挂载列表内容（堆场 35 张缩略图不在展台页初次打开时就全部绘制），
  // 面板外壳常驻，grid 0fr→1fr 的首帧过渡仍然成立。
  const [everOpened, setEverOpened] = useState(open)
  useEffect(() => {
    if (open) setEverOpened(true)
  }, [open])

  const arrow = side === 'left' ? (open ? '‹' : '›') : open ? '›' : '‹'
  const arrowLabel = open ? collapseLabel : expandLabel

  const tab = (
    <button
      type="button"
      className="sc-drawer-tab"
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={arrowLabel}
      title={arrowLabel}
      onClick={onToggle}
    >
      <span className="sc-drawer-arrow" aria-hidden="true">
        {arrow}
      </span>
      <span className="sc-drawer-label">{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span className="sc-drawer-count" aria-hidden="true">
          {count}
        </span>
      )}
    </button>
  )

  const fold = (
    <div className="sc-drawer-fold" inert={!open} aria-hidden={!open}>
      <div className="sc-drawer-clip">
        <div className="sc-drawer-panel" id={panelId} role="region" aria-label={label}>
          {everOpened ? children : null}
        </div>
      </div>
    </div>
  )

  return (
    <div className={`sc-drawer sc-drawer-${side}${open ? ' is-open' : ''}`}>
      {/* DOM 顺序固定为「标签 → 面板」，左侧用 row-reverse 反转为「面板 → 标签」，
          让 Tab 从标签进入面板内容，而不是跳过。 */}
      {tab}
      {fold}
    </div>
  )
}
