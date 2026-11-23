import type { TranslationSchema } from '../../i18n'
import {
  IconDone,
  IconEdit,
  IconInProgress,
  IconMissed,
  IconPin,
  IconTodo,
  IconTrash
} from '../Icons'

interface Props {
  t: TranslationSchema
  isMobile: boolean
  done: boolean
  /** 周频今日已打卡但配额未满：用勾表达事实，颜色仍为墨色（不是绿勾） */
  checkedIn: boolean
  running: boolean
  ended: boolean
  missed: boolean
  pulse: boolean
  pinned: boolean
  statusColor: string
  statusTitle: string
  onStatusClick: (e: React.MouseEvent) => void
  onTogglePin: (e: React.MouseEvent) => void
  onEditClick: (e: React.MouseEvent) => void
  onDeleteClick: (e: React.MouseEvent) => void
}

/** 卡片顶部：状态按钮（打卡/撤销/进行中/未达标）+ 置顶/编辑/删除动作组。 */
export function HabitRowHeader({
  t,
  isMobile,
  done,
  checkedIn,
  running,
  ended,
  missed,
  pulse,
  pinned,
  statusColor,
  statusTitle,
  onStatusClick,
  onTogglePin,
  onEditClick,
  onDeleteClick
}: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <button
        className="status-btn"
        onClick={onStatusClick}
        title={statusTitle}
        style={{
          width: isMobile ? 44 : 40,
          height: isMobile ? 44 : 40,
          minWidth: isMobile ? 44 : undefined,
          minHeight: isMobile ? 44 : undefined,
          color: statusColor,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform var(--dur-lg) var(--ease-bounce)',
          transform: pulse ? 'scale(1.18)' : 'scale(1)'
        }}
      >
        {done || checkedIn ? (
          <IconDone size={36} />
        ) : running || ended ? (
          <IconInProgress size={36} />
        ) : missed ? (
          <IconMissed size={36} />
        ) : (
          <IconTodo size={36} />
        )}
      </button>
      <div className="card-actions-group" style={{ display: 'flex', gap: isMobile ? 4 : 1 }}>
        <button
          className={`card-action${pinned ? ' active' : ''}`}
          style={{
            ...(pinned ? { color: 'var(--accent)' } : undefined),
            ...(isMobile ? { minWidth: 44, minHeight: 44, width: 44, height: 44 } : undefined)
          }}
          title={pinned ? t.today.unpinHabit : t.today.pinHabit}
          aria-label={pinned ? t.today.unpinHabit : t.today.pinHabit}
          onClick={onTogglePin}
        >
          <IconPin size={17} pinned={pinned} />
        </button>
        <button
          className="card-action"
          style={isMobile ? { minWidth: 44, minHeight: 44, width: 44, height: 44 } : undefined}
          title={t.common.edit}
          aria-label={t.common.edit}
          onClick={onEditClick}
        >
          <IconEdit size={17} />
        </button>
        <button
          className="card-action danger"
          style={isMobile ? { minWidth: 44, minHeight: 44, width: 44, height: 44 } : undefined}
          title={t.common.delete}
          aria-label={t.common.delete}
          onClick={onDeleteClick}
        >
          <IconTrash size={17} />
        </button>
      </div>
    </div>
  )
}
