import { useEffect, useState, memo } from 'react'
import { usePlatform, triggerHaptic } from '../platform'
import type { CheckInResult, Habit, MicroMood } from '../types'
import { useAppStore } from '../store/appStore'
import { useTimerStore } from '../store/timerStore'
import { canCheckInHabit, isHabitDueOnDay } from '../logic/checkin'
import { selectHabitCheckInSlice } from '../store/habitSelectors'
import { playComboChime, playSnapSound } from '../audio/sound'
import { useI18n } from '../i18n'
import { ConfirmDialog } from './ConfirmDialog'
import {
  IconDone,
  IconEdit,
  IconInProgress,
  IconMissed,
  IconMood,
  IconNote,
  IconPin,
  IconStar,
  IconTodo,
  IconTrash,
} from './Icons'
interface Props {
  habit: Habit
  done: boolean
  streak: number
  inRestPeriod?: boolean
  day: string
  onCheck?: (res: CheckInResult, habit: Habit) => void
  onEdit?: (habit: Habit) => void
  /** 随笔镌刻保存成功后的回调（宿主页用于弹 toast） */
  onNoteSaved?: () => void
  /** 昨日休整、今日打卡已接续（韧性保护生效，卡片展示反馈） */
  resilienceProtected?: boolean
  /** DOM 锚点 id（提醒「开始打卡」跳转后滚动+高亮定位用） */
  domId?: string
}


/** 周频习惯本周是否已无法达标（剩余天数 < 还需次数） */
function weekMissed(habit: Habit, weekCount: number, day: string): boolean {
  if (habit.frequency.type !== 'weekly') return false
  const need = habit.frequency.times - weekCount
  if (need <= 0) return false
  const d = new Date(day + 'T00:00:00')
  const daysLeft = 7 - ((d.getDay() + 6) % 7)
  return need > daysLeft
}

function fmtRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/**
 * 双列大卡片：
 * 点击未完成卡片 → 开始倒计时（蓝色/进行中）；倒计时到点 → 提醒后再次点击 → 真正打卡（绿色）。
 */
export const HabitRow = memo(function HabitRow({
  habit,
  done,
  streak,
  inRestPeriod,
  day,
  onCheck,
  onEdit,
  onNoteSaved,
  resilienceProtected,
  domId,
}: Props) {
  const { isMobile } = usePlatform()
  const { t } = useI18n()
  const checkIn = useAppStore((s) => s.checkIn)
  const uncheckIn = useAppStore((s) => s.uncheckIn)
  const deleteHabit = useAppStore((s) => s.deleteHabit)
  const togglePinHabit = useAppStore((s) => s.togglePinHabit)
  const recordCheckInNote = useAppStore((s) => s.recordCheckInNote)
  const { todayCheckIns, todayCheckIn, counterVal, weekCount } = useAppStore((s) =>
    selectHabitCheckInSlice(s.checkIns, habit, day),
  )
  const session = useTimerStore((s) => s.sessions[habit.id])
  const startTimer = useTimerStore((s) => s.start)
  const cancelTimer = useTimerStore((s) => s.cancel)

  const [pulse, setPulse] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [showEarlyConfirm, setShowEarlyConfirm] = useState(false)
  const [showUndoConfirm, setShowUndoConfirm] = useState(false)
  const [floatingPill, setFloatingPill] = useState<string | null>(null)

  const isCounter = habit.kind === 'counter'
  const targetVal = habit.targetValue ?? 1
  const counterRatio = Math.min(1, counterVal / targetVal)
  const stepVal = habit.step ?? 1
  const [editingNote, setEditingNote] = useState(false)
  const [noteVal, setNoteVal] = useState(todayCheckIn?.note ?? '')
  const [moodVal, setMoodVal] = useState<MicroMood | undefined>(todayCheckIn?.mood)
  const [starVal, setStarVal] = useState<boolean>(todayCheckIn?.starred ?? false)
  useEffect(() => {
    setNoteVal(todayCheckIn?.note ?? '')
    setMoodVal(todayCheckIn?.mood)
    setStarVal(todayCheckIn?.starred ?? false)
  }, [todayCheckIn?.note, todayCheckIn?.mood, todayCheckIn?.starred])

  function cancelNoteEdit() {
    setNoteVal(todayCheckIn?.note ?? '')
    setMoodVal(todayCheckIn?.mood)
    setStarVal(todayCheckIn?.starred ?? false)
    setEditingNote(false)
  }

  function commitNote() {
    if (todayCheckIn) {
      recordCheckInNote(todayCheckIn.id, noteVal, moodVal ?? null, starVal)
      onNoteSaved?.()
    }
    setEditingNote(false)
  }
  useEffect(() => {
    if (!session) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [session])

  const missed = !done && weekMissed(habit, weekCount, day)
  const isFocus = habit.kind === 'focus' && Boolean(habit.targetMinutes)
  const targetMs = (habit.targetMinutes ?? 25) * 60_000
  // B2：摆件可延长会话，今日页必须用有效目标，否则会在原目标提前显示「待确认」
  const effectiveTargetMs = session?.targetMs ?? targetMs
  const elapsed = session ? now - session.startedAt : 0
  const running = isFocus && !!session && !done && elapsed < effectiveTargetMs
  const ended = isFocus && !!session && !done && elapsed >= effectiveTargetMs
  const progressRatio = effectiveTargetMs > 0 ? elapsed / effectiveTargetMs : 1
  const actualMinutes = Math.max(1, Math.round(elapsed / 60_000))

  const isDueToday = isHabitDueOnDay(habit, day)
  const isRestDay = !done && habit.frequency.type === 'custom' && !isDueToday
  const freqLabel = (() => {
    if (habit.frequency.type === 'daily') return t.today.freqDaily
    if (habit.frequency.type === 'weekly') return t.today.freqWeekly(habit.frequency.times)
    const days = habit.frequency.days
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return t.today.freqWeekdays
    if (days.length === 2 && [6, 7].every((d) => days.includes(d))) return t.today.freqWeekends
    if (days.length === 7) return t.today.freqDaily
    return t.today.freqCustom(days.map((d) => t.common.weekdaysShort[d - 1]))
  })()
  const meta = [
    habit.category ? `#${habit.category}` : '',
    freqLabel,
    inRestPeriod && !done ? t.today.inRestPeriod : '',
    resilienceProtected ? t.today.resilienceContinuation : '',
    habit.period && habit.period !== 'any' ? t.today.periods[habit.period] : '',
    isFocus
      ? t.today.targetMinutes(habit.targetMinutes ?? 25)
      : isCounter
        ? `${targetVal} ${habit.unit ?? ''}`
        : t.today.instantCheckIn,
  ]
    .filter(Boolean)
    .join(' · ')
  function performCheckIn(actualMins?: number, noteText?: string) {
    const verdict = canCheckInHabit(habit, todayCheckIns, day, weekCount)
    if (!verdict.ok) return
    triggerHaptic('medium')
    const res = checkIn(habit.id, actualMins, noteText)
    cancelTimer(habit.id)
    setShowEarlyConfirm(false)
    playSnapSound()
    playComboChime(streak)
    setFloatingPill('+1')
    setPulse(true)
    setTimeout(() => {
      setPulse(false)
      setFloatingPill(null)
    }, 1100)
    onCheck?.(res, habit)
  }

  function handleStepCounter(e?: React.MouseEvent, delta = stepVal) {
    e?.stopPropagation()
    if (delta < 0 && counterVal <= 0) return
    const verdict = canCheckInHabit(habit, todayCheckIns, day, weekCount)
    if (!verdict.ok && delta > 0) return
    triggerHaptic('light')
    const res = checkIn(habit.id, undefined, undefined, delta)
    playSnapSound()
    if (delta > 0) {
      playComboChime(streak)
    }
    setFloatingPill(`${delta > 0 ? '+' : ''}${delta} ${habit.unit ?? ''}`)
    setPulse(true)
    setTimeout(() => {
      setPulse(false)
      setFloatingPill(null)
    }, 1100)
    onCheck?.(res, habit)
  }
  function handleStatusClick() {
    if (done) {
      // 已完成状态点击：支持撤销打卡（有确认，防误触摧毁积木/连击）
      triggerHaptic('light')
      setShowUndoConfirm(true)
      return
    }
    if (isCounter) {
      handleStepCounter()
      return
    }
    if (running) {
      if (progressRatio >= 0.8) {
        triggerHaptic('medium')
        performCheckIn(actualMinutes)
      } else if (progressRatio >= 0.2) {
        triggerHaptic('light')
        setShowEarlyConfirm(true)
      }
      return
    }
    triggerHaptic('medium')
    performCheckIn()
  }
  function handleStartFocus() {
    const verdict = canCheckInHabit(habit, todayCheckIns, day, weekCount)
    if (!verdict.ok) return
    startTimer(habit.id, targetMs)
    setPulse(true)
    setTimeout(() => setPulse(false), 300)
  }

  function handleCardClick() {
    if (done) return
    if (isCounter) {
      handleStepCounter()
      return
    }
    if (isFocus) {
      if (ended) performCheckIn(habit.targetMinutes)
      else if (!running) handleStartFocus()
      return
    }
    performCheckIn()
  }
  const statusColor = done
    ? 'var(--progress-green)'
    : running || ended
      ? 'var(--progress-blue)'
      : 'var(--ink-2)'

  return (
    <div
      id={domId}
      className={`card habit-card${habit.pinned ? ' pinned' : ''}${isMobile ? ' mobile' : ''}`}
      style={{
        position: 'relative',
        opacity: done ? 0.95 : isRestDay ? 0.88 : 1,
        borderColor: done
          ? 'color-mix(in srgb, var(--progress-green) 55%, var(--line))'
          : running || ended
            ? 'color-mix(in srgb, var(--progress-blue) 55%, var(--line))'
            : undefined,
        background: done
          ? 'color-mix(in srgb, var(--progress-green) 7%, var(--surface))'
          : running || ended
            ? 'color-mix(in srgb, var(--progress-blue) 7%, var(--surface))'
            : undefined,
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        handleCardClick()
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <button
          className="status-btn"
          onClick={(e) => {
            e.stopPropagation()
            handleStatusClick()
          }}
          title={
            done
              ? t.today.undoTooltip
              : isRestDay
                ? t.today.restDay
                : missed
                  ? t.today.weekMissed
                  : running
                    ? t.today.timingTooltip
                    : ended
                      ? t.today.checkInTooltip
                      : isFocus
                        ? t.today.focus
                        : t.today.checkInTooltip
          }
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
            transform: pulse ? 'scale(1.25) rotate(90deg)' : 'scale(1) rotate(0deg)',
          }}
        >
          {done ? (
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
            className={`card-action${habit.pinned ? ' active' : ''}`}
            style={{
              ...(habit.pinned ? { color: 'var(--accent)' } : undefined),
              ...(isMobile ? { minWidth: 44, minHeight: 44, width: 44, height: 44 } : undefined),
            }}
            title={habit.pinned ? t.today.unpinHabit : t.today.pinHabit}
            aria-label={habit.pinned ? t.today.unpinHabit : t.today.pinHabit}
            onClick={(e) => {
              e.stopPropagation()
              triggerHaptic('selection')
              togglePinHabit(habit.id)
            }}
          >
            <IconPin size={17} pinned={habit.pinned} />
          </button>
          <button
            className="card-action"
            style={isMobile ? { minWidth: 44, minHeight: 44, width: 44, height: 44 } : undefined}
            title={t.common.edit}
            aria-label={t.common.edit}
            onClick={(e) => {
              e.stopPropagation()
              triggerHaptic('light')
              onEdit?.(habit)
            }}
          >
            <IconEdit size={17} />
          </button>
          <button
            className="card-action danger"
            style={isMobile ? { minWidth: 44, minHeight: 44, width: 44, height: 44 } : undefined}
            title={t.common.delete}
            aria-label={t.common.delete}
            onClick={(e) => {
              e.stopPropagation()
              triggerHaptic('warning')
              setConfirmDelete(true)
            }}
          >
            <IconTrash size={17} />
          </button>
        </div>
      </div>

      <div style={{ fontSize: 'var(--fs-title)', fontWeight: 600, lineHeight: 1.35, marginTop: 6, wordBreak: 'break-word' }}>
        {habit.name}
      </div>
      <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)', marginTop: 4 }}>{meta}</div>
      {habit.note ? (
        <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)', opacity: 0.75, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {habit.note}
        </div>
      ) : null}

      {floatingPill && <div className="checkin-float-pill">{floatingPill}</div>}

      {isCounter && (
        <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-small)' }}>
            <span style={{ fontWeight: 600, color: done ? 'var(--progress-green)' : 'var(--ink)' }}>
              {counterVal} / {targetVal} {habit.unit ?? ''}
            </span>
            <span style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-caption)' }}>
              {Math.round(counterRatio * 100)}%
            </span>
          </div>
          <div className="counter-track">
            <div
              className={`counter-fill${done ? ' done' : ''}`}
              style={{ width: `${Math.round(counterRatio * 100)}%` }}
            />
          </div>
          {!done && (
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                className="pill-action"
                disabled={counterVal <= 0}
                onClick={(e) => handleStepCounter(e, -stepVal)}
                title={`-${stepVal} ${habit.unit ?? ''}`}
                aria-label={`-${stepVal} ${habit.unit ?? ''}`}
                style={{
                  ...(isMobile ? { minWidth: 44, minHeight: 44, padding: '10px 14px' } : {}),
                  opacity: counterVal <= 0 ? 0.4 : 1,
                  cursor: counterVal <= 0 ? 'not-allowed' : 'pointer',
                }}
              >
                -{stepVal} {habit.unit ?? ''}
              </button>
              <button
                className="pill-action success"
                onClick={(e) => handleStepCounter(e, stepVal)}
                title={`+${stepVal} ${habit.unit ?? ''}`}
                aria-label={`+${stepVal} ${habit.unit ?? ''}`}
                style={isMobile ? { minWidth: 44, minHeight: 44, padding: '10px 14px' } : undefined}
              >
                +{stepVal} {habit.unit ?? ''}
              </button>
            </div>
          )}
        </div>
      )}

      {done && (
        <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
          {editingNote ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="micro-mood-group">
                  {(['energetic', 'hard', 'spark', 'calm'] as MicroMood[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`micro-mood-chip${moodVal === m ? ' active' : ''}`}
                      onClick={() => {
                        triggerHaptic('selection')
                        setMoodVal((prev) => (prev === m ? undefined : m))
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <IconMood mood={m} size={12} style={{ flexShrink: 0 }} />
                      <span>{t.microMood[m]}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={`star-toggle-btn${starVal ? ' starred' : ''}`}
                  style={{ padding: '3px 8px' }}
                  onClick={() => {
                    triggerHaptic('selection')
                    setStarVal((prev) => !prev)
                  }}
                  title={starVal ? t.reflections.unstarTooltip : t.reflections.starTooltip}
                >
                  <IconStar size={13} filled={starVal} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="text"
                  autoFocus
                  className="micro-note-input"
                  value={noteVal}
                  placeholder={t.reflections.engravePlaceholder}
                  onChange={(e) => setNoteVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitNote()
                    } else if (e.key === 'Escape') {
                      cancelNoteEdit()
                    }
                  }}
                />
                <button
                  type="button"
                  className="pill-action"
                  onClick={commitNote}
                  style={{ padding: '4px 10px', fontSize: 'var(--fs-caption)' }}
                >
                  {t.common.complete}
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingNote(true)}
              style={{
                fontSize: 'var(--fs-small)',
                color: todayCheckIn?.note || todayCheckIn?.mood ? 'var(--ink)' : 'var(--ink-2)',
                opacity: todayCheckIn?.note || todayCheckIn?.mood ? 0.95 : 0.6,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 6px',
                borderRadius: 'var(--r-sm)',
                background: todayCheckIn?.note || todayCheckIn?.mood ? 'color-mix(in srgb, var(--ink) 3%, transparent)' : 'transparent',
              }}
              title={t.reflections.brickInspectEditHint}
            >
              {todayCheckIn?.starred && (
                <IconStar size={12} filled style={{ color: 'var(--accent)', flexShrink: 0 }} />
              )}
              {todayCheckIn?.mood && (
                <span
                  style={{
                    fontSize: 'var(--fs-caption)',
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))',
                    color: 'var(--ink)',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <IconMood mood={todayCheckIn.mood as MicroMood} size={11} style={{ flexShrink: 0 }} />
                  <span>{t.microMood[todayCheckIn.mood as MicroMood]}</span>
                </span>
              )}
              <IconNote size={13} style={{ color: 'var(--ink-2)', flexShrink: 0 }} />
              <span style={{ fontStyle: todayCheckIn?.note ? 'normal' : 'italic' }}>
                {todayCheckIn?.note || t.today.addReflectionPlaceholder}
              </span>
            </div>
          )}
        </div>
      )}

      {running && (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                className="big-num"
                style={{ fontSize: 'var(--fs-display)', color: 'var(--progress-blue)', lineHeight: 1 }}
              >
                {fmtRemaining(session ? session.startedAt + effectiveTargetMs - now : 0)}
              </span>
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)' }}>
                {t.today.focusedMinutes(actualMinutes)}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              {progressRatio >= 0.8 ? (
                <button
                  className="pill-action success"
                  style={isMobile ? { minWidth: 44, minHeight: 44, padding: '10px 14px' } : undefined}
                  onClick={(e) => {
                    e.stopPropagation()
                    performCheckIn(actualMinutes)
                  }}
                  title={t.today.readyToFinish}
                >
                  {t.common.complete}
                </button>
              ) : progressRatio >= 0.2 ? (
                <button
                  className="pill-action"
                  style={isMobile ? { minWidth: 44, minHeight: 44, padding: '10px 14px' } : undefined}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowEarlyConfirm((v) => !v)
                  }}
                  title={t.today.earlyFinish}
                >
                  {t.today.earlyFinish}
                </button>
              ) : null}

              <button
                className="pill-action danger"
                style={isMobile ? { minWidth: 44, minHeight: 44, padding: '10px 14px' } : undefined}
                title={t.today.cancelTimer}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowEarlyConfirm(false)
                  cancelTimer(habit.id)
                }}
              >
                {t.today.cancelTimer}
              </button>
            </div>
          </div>

          {showEarlyConfirm && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 12px',
                background: 'color-mix(in srgb, var(--ink) 5%, transparent)',
                borderRadius: 'var(--r-md)',
                fontSize: 'var(--fs-small)',
                animation: 'pop-in var(--dur-xs) var(--ease-out)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ color: 'var(--ink)', marginBottom: 6 }}>
                {t.today.earlyConfirmMsg(actualMinutes)}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  className="pill-action"
                  style={{ fontSize: 'var(--fs-caption)', padding: isMobile ? '10px 14px' : '3px 10px', ...(isMobile ? { minWidth: 44, minHeight: 44 } : undefined) }}
                  onClick={() => setShowEarlyConfirm(false)}
                >
                  {t.common.cancel}
                </button>
                <button
                  className="pill-action success"
                  style={{ fontSize: 'var(--fs-caption)', padding: isMobile ? '10px 14px' : '3px 10px', ...(isMobile ? { minWidth: 44, minHeight: 44 } : undefined) }}
                  onClick={() => performCheckIn(actualMinutes)}
                >
                  {t.today.earlyFinish}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {ended && (
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 'var(--fs-body)', color: 'var(--progress-blue)', fontWeight: 600 }}>
            {t.today.timingTooltip}
          </span>
          <button
            className="pill-action success"
            onClick={(e) => {
              e.stopPropagation()
              performCheckIn()
            }}
            style={{
              background: 'var(--progress-green)',
              color: 'var(--surface)',
              ...(isMobile ? { minWidth: 44, minHeight: 44, padding: '10px 14px' } : undefined),
            }}
          >
            {t.common.complete}
          </button>
        </div>
      )}
      {!session && !running && !ended && isFocus && !done && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="pill-action"
            style={isMobile ? { minWidth: 44, minHeight: 44, padding: '10px 14px' } : undefined}
            onClick={(e) => {
              e.stopPropagation()
              handleStartFocus()
            }}
          >
            {t.today.focus} ({t.today.targetMinutes(habit.targetMinutes ?? 25)})
          </button>
        </div>
      )}
      {!running && !ended && (
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 'var(--fs-small)',
              borderRadius: 999,
              padding: '3px 11px',
              color: done ? 'var(--accent-ink)' : 'var(--ink-2)',
              background: done
                ? 'var(--progress-green)'
                : isRestDay
                  ? 'color-mix(in srgb, var(--ink) 4%, transparent)'
                  : 'var(--bg)',
              border: done ? 'none' : '1px solid var(--line)',
              cursor: done ? 'pointer' : 'default',
            }}
            onClick={(e) => {
              if (done) {
                e.stopPropagation()
                setShowUndoConfirm(true)
              }
            }}
            title={
              done
                ? t.today.undoTooltip
                : isRestDay
                  ? t.today.restDay
                  : undefined
            }
          >
            {done ? t.today.completedPill : isRestDay ? t.today.restDay : t.today.checkInTooltip}
          </span>
          {streak > 0 && (
            <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>{t.stats.currentStreak(streak)}</span>
          )}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={t.today.deleteConfirmTitle}
          message={t.today.deleteConfirmMsg(habit.name)}
          confirmLabel={t.common.delete}
          cancelLabel={t.common.cancel}
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            cancelTimer(habit.id)
            deleteHabit(habit.id)
            setConfirmDelete(false)
          }}
        />
      )}

      {showUndoConfirm && (
        <ConfirmDialog
          title={t.today.undoConfirmTitle}
          message={t.today.undoConfirmBody}
          confirmLabel={t.today.undoConfirmAction}
          cancelLabel={t.common.cancel}
          danger={false}
          onCancel={() => setShowUndoConfirm(false)}
          onConfirm={() => {
            uncheckIn(habit.id, day)
            setShowUndoConfirm(false)
          }}
        />
      )}
    </div>
  )
})
