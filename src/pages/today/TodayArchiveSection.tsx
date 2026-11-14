import { ConfirmDialog } from '../../components/ConfirmDialog'
import { IconRestore, IconTrash } from '../../components/Icons'
import { useI18n } from '../../i18n'
import type { Habit } from '../../types'

interface Props {
  archived: Habit[]
  showArchive: boolean
  archDelete: Habit | null
  onToggleArchive: () => void
  onRestore: (id: string) => void
  onDeleteRequest: (habit: Habit) => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}

/** 归档区：折叠列表 + 恢复 + 永久删除确认。 */
export function TodayArchiveSection({
  archived,
  showArchive,
  archDelete,
  onToggleArchive,
  onRestore,
  onDeleteRequest,
  onCancelDelete,
  onConfirmDelete
}: Props) {
  const { t } = useI18n()
  return (
    <section style={{ maxWidth: 720, margin: '28px auto 0', padding: '0 24px' }}>
      <button
        className="archive-toggle"
        onClick={onToggleArchive}
        title={showArchive ? t.today.collapse : t.today.expand}
      >
        <span>{t.today.archivedCount(archived.length)}</span>
        <span style={{ fontSize: 'var(--fs-caption)' }}>
          {showArchive ? t.today.collapse : t.today.expand}
        </span>
      </button>
      {showArchive && (
        <div className="archive-list">
          {archived.map((h) => (
            <div key={h.id} className="archive-row">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-subhead)', color: 'var(--ink-2)' }}>{h.name}</div>
                <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)', opacity: 0.7 }}>
                  {h.frequency.type === 'daily'
                    ? t.today.freqDaily
                    : h.frequency.type === 'weekly'
                      ? t.today.freqWeekly(h.frequency.times)
                      : t.today.freqCustom(
                          h.frequency.days.map((d) => t.common.weekdaysShort[d - 1])
                        )}
                  {h.targetMinutes ? ` · ${t.common.timeMinutes(h.targetMinutes)}` : ''}
                  {h.targetValue ? ` · ${h.targetValue} ${h.unit ?? ''}` : ''}
                </div>
              </div>
              <button
                className="archive-act"
                title={t.common.restore}
                onClick={() => onRestore(h.id)}
              >
                <IconRestore size={16} />
                {t.common.restore}
              </button>
              <button
                className="archive-act"
                title={t.common.delete}
                onClick={() => onDeleteRequest(h)}
              >
                <IconTrash size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {archDelete && (
        <div style={{ marginTop: 8 }}>
          <ConfirmDialog
            title={t.today.deleteConfirmTitle}
            message={t.today.deleteConfirmMsg(archDelete.name)}
            confirmLabel={t.common.delete}
            cancelLabel={t.common.cancel}
            danger
            onCancel={onCancelDelete}
            onConfirm={onConfirmDelete}
          />
        </div>
      )}
    </section>
  )
}
