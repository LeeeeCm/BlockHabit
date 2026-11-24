import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useI18n } from '../../i18n'
import { dayCounterValue, weekCountFor } from '../../logic/checkin'
import { petCounterStep, type PetPendingHabit } from '../../logic/petActions'
import type { PendingReminder } from '../../store/reminderStore'
import type { CheckIn, Habit } from '../../types'
import { IconClose } from '../Icons'

export function counterProgress(habit: Habit, checkIns: CheckIn[], day: string): string {
  const unit = habit.unit ? ` ${habit.unit}` : ''
  return `${dayCounterValue(checkIns, habit.id, day)} / ${habit.targetValue ?? 0}${unit}`
}

interface ReminderProps {
  reminders: PendingReminder[]
  rows: PetPendingHabit[]
  activeFocusIds: ReadonlySet<string>
  onRecord: (id: string, reminder: PendingReminder) => void
  onSnooze: (reminder: PendingReminder) => void
  onDismiss?: () => void
}

export function PetReminders({
  reminders,
  rows,
  activeFocusIds,
  onRecord,
  onSnooze,
  onDismiss
}: ReminderProps) {
  const { t } = useI18n()
  if (reminders.length === 0) return null
  return (
    <section
      className={onDismiss ? 'pet-bubble pet-reminder-bubble' : 'pet-inline-reminders'}
      aria-label={t.pet.reminderTitle}
      data-testid="pet-reminder-bubble"
    >
      <div className="pet-panel-heading">
        <strong role="status">
          {t.pet.reminderTitle} · {t.pet.reminderCount(reminders.length)}
        </strong>
        {onDismiss && (
          <button
            type="button"
            className="icon-btn pet-close"
            aria-label={t.pet.dismissReminder}
            onClick={onDismiss}
          >
            <IconClose size={14} />
          </button>
        )}
      </div>
      <ul className="pet-reminder-list">
        {reminders.map((item) => {
          const row = rows.find(({ habit }) => habit.id === item.habitId)
          if (!row) return null
          const { habit, canRecord } = row
          return (
            <li className="pet-reminder-row" key={habit.id}>
              <span className="pet-row-name" title={habit.name}>
                {habit.name}
              </span>
              {canRecord && (
                <button
                  type="button"
                  className="btn ghost pet-compact-button"
                  onClick={() => onRecord(habit.id, item)}
                >
                  {habit.kind === 'focus'
                    ? activeFocusIds.has(habit.id)
                      ? t.pet.continueFocus
                      : t.pet.startFocus
                    : habit.kind === 'counter'
                      ? t.pet.step(`${petCounterStep(habit)}${habit.unit ? ` ${habit.unit}` : ''}`)
                      : t.pet.record}
                </button>
              )}
              <button
                type="button"
                className="btn ghost pet-compact-button"
                onClick={() => onSnooze(item)}
              >
                {t.reminder.snoozeBtn}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

interface PanelProps {
  rows: PetPendingHabit[]
  dueCount: number
  checkIns: CheckIn[]
  day: string
  pinned: boolean
  activeFocusIds: ReadonlySet<string>
  prompts?: ReactNode
  onRecord: (id: string) => void
  onClose: () => void
  onToday: () => void
  onSettings?: () => void
  onTogglePin: () => void
  onHide: () => void
}

export function PetSidePanel({
  rows,
  dueCount,
  checkIns,
  day,
  pinned,
  activeFocusIds,
  prompts,
  onRecord,
  onClose,
  onToday,
  onSettings,
  onTogglePin,
  onHide
}: PanelProps) {
  const { t } = useI18n()
  const headingId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
  }, [])
  return (
    <aside
      className="pet-side-panel"
      role="dialog"
      aria-labelledby={headingId}
      data-testid="pet-side-panel"
    >
      <header className="pet-panel-heading">
        <div>
          <h2 id={headingId}>{t.pet.pendingTitle}</h2>
          {rows.length > 0 && <small>{t.pet.remaining(rows.length)}</small>}
        </div>
        <button
          type="button"
          ref={closeRef}
          className="icon-btn pet-close"
          aria-label={t.common.close}
          onClick={onClose}
        >
          <IconClose size={16} />
        </button>
      </header>
      <div className="pet-panel-body">
        {prompts}
        {rows.length === 0 ? (
          <p className="pet-empty">{dueCount > 0 ? t.pet.allDone : t.pet.noSchedule}</p>
        ) : (
          <ul className="pet-pending-list">
            {rows.map(({ habit, canRecord }) => {
              const progress =
                habit.kind === 'counter'
                  ? counterProgress(habit, checkIns, day)
                  : habit.frequency.type === 'weekly'
                    ? `${weekCountFor(checkIns, habit.id, day)} / ${habit.frequency.times}`
                    : ''
              const label =
                habit.kind === 'counter'
                  ? t.pet.step(`${petCounterStep(habit)}${habit.unit ? ` ${habit.unit}` : ''}`)
                  : habit.kind === 'focus'
                    ? activeFocusIds.has(habit.id)
                      ? t.pet.continueFocus
                      : t.pet.startFocus
                    : t.pet.record
              return (
                <li className="pet-habit-row" key={habit.id}>
                  <div className="pet-row-info">
                    <strong>{habit.name}</strong>
                    {progress && <small>{progress}</small>}
                  </div>
                  {canRecord ? (
                    <button
                      type="button"
                      className="btn ghost pet-compact-button"
                      aria-label={`${habit.name} · ${label}`}
                      onClick={() => onRecord(habit.id)}
                    >
                      {label}
                    </button>
                  ) : (
                    <small>{t.pet.alreadyToday}</small>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <footer className="pet-panel-actions">
        <button type="button" className="btn primary" onClick={onToday}>
          {t.pet.showToday}
        </button>
        {onSettings && (
          <button type="button" className="btn ghost" onClick={onSettings}>
            {t.pet.settings}
          </button>
        )}
        <button type="button" className="btn ghost" aria-pressed={pinned} onClick={onTogglePin}>
          {pinned ? t.pet.unpin : t.pet.pin}
        </button>
        <button type="button" className="btn ghost" onClick={onHide}>
          {t.pet.fold}
        </button>
      </footer>
    </aside>
  )
}
