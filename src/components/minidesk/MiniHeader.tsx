import { MINI_PRESETS, type MiniSize } from '../../platform/miniWindow'
import { useI18n } from '../../i18n'
import { IconExpand, IconPin, IconWinClose } from '../Icons'
import logoUrl from '../../assets/logo-mark.svg'

const CONTROL_SIZE = 32
const ICON_BTN_STYLE = {
  width: CONTROL_SIZE,
  height: CONTROL_SIZE,
  borderRadius: 7,
  flexShrink: 0
}

interface MiniHeaderProps {
  size: MiniSize
  pinned: boolean
  onTogglePin: () => void
  onExpand: () => void
  onClose: () => void
}

/** 顶部轻量拖拽栏（双击展开主窗） */
export function MiniHeader({ size, pinned, onTogglePin, onExpand, onClose }: MiniHeaderProps) {
  const { t } = useI18n()
  const preset = MINI_PRESETS[size]
  const compact = size === 'pocket'
  return (
    <div
      data-tauri-drag-region
      onDoubleClick={onExpand}
      title={t.mini.doubleClickHint}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 4,
        padding: compact ? '2px 6px' : '2px 8px',
        height: preset.headerH,
        flexShrink: 0,
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg)',
        cursor: 'move'
      }}
    >
      <div
        data-tauri-drag-region
        style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}
      >
        <img src={logoUrl} alt="" width={compact ? 12 : 14} height={compact ? 12 : 14} />
        <span
          data-tauri-drag-region
          style={{
            fontSize: compact ? 'var(--fs-caption)' : 'var(--fs-small)',
            fontWeight: 700,
            fontFamily: "'Rubik', sans-serif",
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          BlockHabit
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <button
          className="icon-btn"
          onClick={onTogglePin}
          title={t.settings.miniAlwaysOnTopLabel}
          aria-label={t.settings.miniAlwaysOnTopLabel}
          style={ICON_BTN_STYLE}
        >
          <IconPin size={compact ? 12 : 14} pinned={pinned} />
        </button>
        <button
          className="icon-btn"
          onClick={onExpand}
          title={t.mini.expandTooltip}
          style={ICON_BTN_STYLE}
        >
          <IconExpand size={compact ? 12 : 14} />
        </button>
        <button
          className="icon-btn"
          onClick={onClose}
          title={t.mini.closeTooltip}
          style={ICON_BTN_STYLE}
        >
          <IconWinClose size={compact ? 12 : 14} />
        </button>
      </div>
    </div>
  )
}
