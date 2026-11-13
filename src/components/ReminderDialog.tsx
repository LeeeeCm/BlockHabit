import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { useReminderStore } from '../store/reminderStore'
import { useI18n } from '../i18n'
import { SNOOZE_MINUTES, parseHHmm } from '../logic/reminderScheduler'
import { playSnapSound } from '../audio/sound'
import { triggerHaptic } from '../platform'
import { useDialogA11y } from './useDialogA11y'
import { IconMoodHard } from './Icons'
import { IconClose } from './Icons'

interface Props {
  /** 「开始打卡」：宿主负责关弹窗跳转 Today 并高亮该习惯 */
  onStart?: (habitId: string) => void
  /** 宿主页 toast 通道（贪睡/跳过反馈） */
  onToast?: (text: string) => void
}

/**
 * 积木风到点提醒弹窗：
 * - 顶部小积木依次掉落咬合入场（首块落定播咬合声）
 * - pending 队列合并为一个列表呈现（多个提醒不打连环炮）
 * - 窗口藏在托盘时提醒先入队，回窗后此弹窗自然呈现（不主动唤起窗口）
 */
export function ReminderDialog({ onStart, onToast }: Props) {
  const { t } = useI18n()
  const pending = useReminderStore((s) => s.pending)
  const suppressed = useReminderStore((s) => s.suppressed)
  const dismiss = useReminderStore((s) => s.dismiss)
  const acknowledge = useReminderStore((s) => s.acknowledge)
  const snooze = useReminderStore((s) => s.snooze)
  const skipReminderToday = useAppStore((s) => s.skipReminderToday)
  const open = pending.length > 0 && !suppressed
  const { ref: dialogRef } = useDialogA11y({ open, onClose: acknowledge })

  // 积木落定咬合声：仅在队列变长时播一次（550ms ≈ 首块落定时刻）
  const prevLenRef = useRef(0)
  useEffect(() => {
    if (pending.length > prevLenRef.current) {
      const timer = setTimeout(() => playSnapSound(), 550)
      prevLenRef.current = pending.length
      return () => clearTimeout(timer)
    }
    prevLenRef.current = pending.length
  }, [pending.length])

  if (!open) return null

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()

  function handleSnooze(habitId: string) {
    const ok = snooze(habitId, Date.now() + SNOOZE_MINUTES * 60_000)
    if (ok) {
      dismiss(habitId)
      triggerHaptic('light')
      onToast?.(t.reminder.snoozedToast(SNOOZE_MINUTES))
    } else {
      onToast?.(t.reminder.snoozeLimitToast)
    }
  }

  function handleSkip(habitId: string) {
    skipReminderToday(habitId)
    dismiss(habitId)
    triggerHaptic('warning')
    onToast?.(t.reminder.skippedToast)
  }

  function handleStart(habitId: string) {
    dismiss(habitId)
    triggerHaptic('medium')
    onStart?.(habitId)
  }

  const list = (
    <div className="reminder-list">
      {pending.map((item) => {
        const endMin = item.end !== undefined ? parseHHmm(item.end) : null
        const minutesLeft = endMin !== null ? endMin - nowMin : null
        return (
          <div
            key={item.habitId}
            className={`reminder-item${item.stage === 'due-soon' ? ' due-soon' : ''}`}
          >
            <div className="reminder-item-title">
              <span
                style={{ display: 'inline-flex', color: 'var(--ink-2)', flexShrink: 0 }}
                aria-hidden="true"
              >
                <IconMoodHard size={14} />
              </span>
              <span
                style={{
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {item.name}
              </span>
              {item.stage === 'due-soon' && (
                <span className="reminder-due-badge">{t.reminder.dueSoonBadge}</span>
              )}
            </div>
            <div className="reminder-item-meta">
              <span>{t.reminder.startLabel(item.start)}</span>
              {item.end && <span>· {t.reminder.endLabel(item.end)}</span>}
              {minutesLeft !== null && minutesLeft > 0 && minutesLeft <= 60 && (
                <span>· {t.reminder.minutesLeft(minutesLeft)}</span>
              )}
            </div>
            <div className="reminder-item-actions">
              <button
                className="btn primary"
                style={{ fontSize: 'var(--fs-body)', padding: '6px 14px' }}
                onClick={() => handleStart(item.habitId)}
              >
                {t.reminder.startBtn}
              </button>
              <button
                className="btn ghost"
                style={{ fontSize: 'var(--fs-body)', padding: '6px 12px' }}
                onClick={() => handleSnooze(item.habitId)}
              >
                {t.reminder.snoozeBtn}
              </button>
              <button
                className="btn ghost"
                style={{ fontSize: 'var(--fs-body)', padding: '6px 12px' }}
                onClick={() => handleSkip(item.habitId)}
              >
                {t.reminder.skipBtn}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )

  const bricks = (
    <div className="reminder-bricks" aria-hidden="true">
      <span className="reminder-brick" />
      <span className="reminder-brick" />
      <span className="reminder-brick" />
    </div>
  )

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t.reminder.dialogTitle}
      tabIndex={-1}
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && acknowledge()}
    >
      <div className="dialog reminder-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{t.reminder.dialogTitle}</h3>
          <button className="icon-btn" onClick={acknowledge} title={t.common.close}>
            <IconClose size={18} />
          </button>
        </div>
        <div className="dialog-body">
          {bricks}
          <div style={{ height: 10 }} />
          {list}
          <div style={{ height: 4 }} />
        </div>
      </div>
    </div>
  )
}
