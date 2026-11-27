import { useEffect, useRef, useState, memo } from 'react'
import { usePlatform, triggerHaptic } from '../platform'
import type { CheckInResult, Habit, MicroMood } from '../types'
import { useAppStore } from '../store/appStore'
import { useTimerStore } from '../store/timerStore'
import { canCheckInHabit, isHabitDueOnDay } from '../logic/checkin'
import { effectiveTargetMs } from '../logic/focusSession'
import { selectHabitCheckInSlice } from '../store/habitSelectors'
import { playComboChime, playSnapSound } from '../audio/sound'
import { useI18n } from '../i18n'
import { HabitRowHeader } from './habitrow/HabitRowHeader'
import { HabitCounterSection } from './habitrow/HabitCounterSection'
import { HabitReflectionSection } from './habitrow/HabitReflectionSection'
import { HabitFocusSection } from './habitrow/HabitFocusSection'
import { HabitRowFooter } from './habitrow/HabitRowFooter'
import { HabitRowDialogs } from './habitrow/HabitRowDialogs'
import { MoodPickerDialog } from './MoodPickerDialog'
import { isQuotaOnlyDone, weekMissed } from './habitrow/helpers'

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
  domId
}: Props) {
  const { isMobile } = usePlatform()
  const { t } = useI18n()
  const checkIn = useAppStore((s) => s.checkIn)
  const uncheckIn = useAppStore((s) => s.uncheckIn)
  const deleteHabit = useAppStore((s) => s.deleteHabit)
  const togglePinHabit = useAppStore((s) => s.togglePinHabit)
  const recordCheckInNote = useAppStore((s) => s.recordCheckInNote)
  const { todayCheckIns, todayCheckIn, counterVal, weekCount } = useAppStore((s) =>
    selectHabitCheckInSlice(s.checkIns, habit, day)
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
  const [moodNoteVal, setMoodNoteVal] = useState<string | undefined>(todayCheckIn?.moodNote)
  const [starVal, setStarVal] = useState<boolean>(todayCheckIn?.starred ?? false)
  /** 随笔编辑模块的 DOM 边界：只有点击它外面才取消编辑 */
  const reflectionRef = useRef<HTMLDivElement>(null)
  /** 心境选择弹窗（D-20261126-118） */
  const [moodPickerOpen, setMoodPickerOpen] = useState(false)
  useEffect(() => {
    setNoteVal(todayCheckIn?.note ?? '')
    setMoodVal(todayCheckIn?.mood)
    setMoodNoteVal(todayCheckIn?.moodNote)
    setStarVal(todayCheckIn?.starred ?? false)
  }, [todayCheckIn?.note, todayCheckIn?.mood, todayCheckIn?.moodNote, todayCheckIn?.starred])

  function cancelNoteEdit() {
    setNoteVal(todayCheckIn?.note ?? '')
    setMoodVal(todayCheckIn?.mood)
    setMoodNoteVal(todayCheckIn?.moodNote)
    setStarVal(todayCheckIn?.starred ?? false)
    setEditingNote(false)
  }

  // D-20261128-132：随笔编辑只在「点击模块外」时取消。
  // 键盘输入、鼠标移出卡片、焦点变化都不再取消；心境弹窗打开期间不把弹窗点击算作模块外。
  useEffect(() => {
    if (!editingNote) return
    const onPointerDown = (event: PointerEvent) => {
      if (moodPickerOpen) return
      const node = reflectionRef.current
      if (node && event.target instanceof Node && node.contains(event.target)) return
      cancelNoteEdit()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [editingNote, moodPickerOpen, todayCheckIn])

  function commitNote() {
    if (todayCheckIn) {
      recordCheckInNote(
        todayCheckIn.id,
        noteVal,
        moodNoteVal ? null : (moodVal ?? null),
        starVal,
        moodNoteVal ?? null
      )
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
  /** 周配额已满、今日未打卡：卡片显示完成，但今日没有可撤销的记录 */
  const doneByQuotaOnly = done && isQuotaOnlyDone(habit, weekCount, todayCheckIns.length)
  const isFocus = habit.kind === 'focus' && Boolean(habit.targetMinutes)
  const targetMs = (habit.targetMinutes ?? 25) * 60_000
  // B2/B4：摆件可延长会话，今日页必须用「含延长的有效目标」，否则会在原目标提前显示「待确认」
  const sessionTargetMs = session ? effectiveTargetMs(session) : targetMs
  const elapsed = session ? now - session.startedAt : 0
  const running = isFocus && !!session && elapsed < sessionTargetMs
  const ended = isFocus && !!session && elapsed >= sessionTargetMs
  const progressRatio = sessionTargetMs > 0 ? elapsed / sessionTargetMs : 1
  const actualMinutes = Math.max(1, Math.round(elapsed / 60_000))

  const isDueToday = isHabitDueOnDay(habit, day)
  const isRestDay = !done && habit.frequency.type === 'custom' && !isDueToday
  const freqLabel = (() => {
    if (habit.frequency.type === 'daily') return t.today.freqDaily
    if (habit.frequency.type === 'weekly') {
      return habit.kind === 'counter'
        ? t.today.freqWeekly(habit.frequency.times)
        : t.today.freqWeeklyProgress(weekCount, habit.frequency.times)
    }
    const days = habit.frequency.days
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d)))
      return t.today.freqWeekdays
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
        : t.today.instantCheckIn
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
      // 周配额已满但今日未打卡时没有可撤销的记录，点击不弹撤销确认
      if (doneByQuotaOnly) return
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

  function stopCardClick(e: React.MouseEvent) {
    e.stopPropagation()
  }
  function handleStatusBtnClick(e: React.MouseEvent) {
    e.stopPropagation()
    handleStatusClick()
  }
  function handleTogglePin(e: React.MouseEvent) {
    e.stopPropagation()
    triggerHaptic('selection')
    togglePinHabit(habit.id)
  }
  function handleEditClick(e: React.MouseEvent) {
    e.stopPropagation()
    triggerHaptic('light')
    onEdit?.(habit)
  }
  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    triggerHaptic('warning')
    setConfirmDelete(true)
  }
  function handleStepDown(e: React.MouseEvent) {
    handleStepCounter(e, -stepVal)
  }
  function handleStepUp(e: React.MouseEvent) {
    handleStepCounter(e, stepVal)
  }
  function handleToggleMood(m: MicroMood) {
    triggerHaptic('selection')
    // 选预设即放弃自定义文本（两者互斥，见 recordCheckInNote）
    setMoodNoteVal(undefined)
    setMoodVal((prev) => (prev === m ? undefined : m))
  }
  function handleToggleStar() {
    triggerHaptic('selection')
    setStarVal((prev) => !prev)
  }
  function handleNoteChange(e: React.ChangeEvent<HTMLInputElement>) {
    setNoteVal(e.target.value)
  }
  function handleNoteKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      commitNote()
    } else if (e.key === 'Escape') {
      cancelNoteEdit()
    }
  }
  function handleStartEditNote() {
    setEditingNote(true)
  }
  function handleCompleteEarly(e: React.MouseEvent) {
    e.stopPropagation()
    performCheckIn(actualMinutes)
  }
  function handleToggleEarlyConfirm(e: React.MouseEvent) {
    e.stopPropagation()
    setShowEarlyConfirm((v) => !v)
  }
  function handleCancelTimer(e: React.MouseEvent) {
    e.stopPropagation()
    setShowEarlyConfirm(false)
    cancelTimer(habit.id)
  }
  function handleConfirmEarly() {
    performCheckIn(actualMinutes)
  }
  function handleCancelEarlyConfirm() {
    setShowEarlyConfirm(false)
  }
  function handleEndedComplete(e: React.MouseEvent) {
    e.stopPropagation()
    performCheckIn()
  }
  function handleStartFocusClick(e: React.MouseEvent) {
    e.stopPropagation()
    handleStartFocus()
  }
  function handleFooterPillClick(e: React.MouseEvent) {
    if (done && !doneByQuotaOnly) {
      e.stopPropagation()
      setShowUndoConfirm(true)
    }
  }
  function handleConfirmDelete() {
    cancelTimer(habit.id)
    deleteHabit(habit.id)
    setConfirmDelete(false)
  }
  function handleConfirmUndo() {
    uncheckIn(habit.id, day)
    setShowUndoConfirm(false)
  }
  const statusColor = done
    ? 'var(--progress-green)'
    : running || ended
      ? 'var(--progress-blue)'
      : 'var(--ink-2)'
  const remainingMs = session ? session.startedAt + sessionTargetMs - now : 0

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
            : undefined
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        handleCardClick()
      }}
    >
      <HabitRowHeader
        t={t}
        isMobile={isMobile}
        done={done}
        running={running}
        ended={ended}
        missed={missed}
        isRestDay={isRestDay}
        isFocus={isFocus}
        pulse={pulse}
        pinned={Boolean(habit.pinned)}
        statusColor={statusColor}
        doneByQuotaOnly={doneByQuotaOnly}
        onStatusClick={handleStatusBtnClick}
        onTogglePin={handleTogglePin}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
      />

      <div
        style={{
          fontSize: 'var(--fs-title)',
          fontWeight: 600,
          lineHeight: 1.35,
          marginTop: 6,
          wordBreak: 'break-word'
        }}
      >
        {habit.name}
      </div>
      <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)', marginTop: 4 }}>{meta}</div>
      {habit.note ? (
        <div
          style={{
            fontSize: 'var(--fs-small)',
            color: 'var(--ink-2)',
            opacity: 0.75,
            marginTop: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {habit.note}
        </div>
      ) : null}

      {floatingPill && <div className="checkin-float-pill">{floatingPill}</div>}

      {moodPickerOpen && (
        <MoodPickerDialog
          mood={moodVal}
          moodNote={moodNoteVal}
          onClose={() => setMoodPickerOpen(false)}
          onPickMood={(next) => {
            setMoodNoteVal(undefined)
            setMoodVal(next ?? undefined)
          }}
          onPickNote={(note) => {
            if (!note.trim()) {
              setMoodNoteVal(undefined)
              return
            }
            setMoodVal(undefined)
            setMoodNoteVal(note.trim())
          }}
        />
      )}

      {isCounter && (
        <HabitCounterSection
          counterVal={counterVal}
          targetVal={targetVal}
          counterRatio={counterRatio}
          done={done}
          stepVal={stepVal}
          unit={habit.unit}
          isMobile={isMobile}
          onStepDown={handleStepDown}
          onStepUp={handleStepUp}
          onStopCardClick={stopCardClick}
        />
      )}

      {done && todayCheckIn && (
        <div ref={reflectionRef}>
          <HabitReflectionSection
            t={t}
            todayCheckIn={todayCheckIn}
            editingNote={editingNote}
            noteVal={noteVal}
            moodVal={moodVal}
            moodNoteVal={moodNoteVal}
            starVal={starVal}
            onStartEdit={handleStartEditNote}
            onToggleMood={handleToggleMood}
            onToggleStar={handleToggleStar}
            onOpenMoodPicker={() => setMoodPickerOpen(true)}
            onNoteChange={handleNoteChange}
            onNoteKeyDown={handleNoteKeyDown}
            onCommit={commitNote}
            onStopCardClick={stopCardClick}
          />
        </div>
      )}

      <HabitFocusSection
        t={t}
        isMobile={isMobile}
        done={done}
        running={running}
        ended={ended}
        showFocusStart={!session && !running && !ended && isFocus && !done}
        showEarlyConfirm={showEarlyConfirm}
        remainingMs={remainingMs}
        actualMinutes={actualMinutes}
        progressRatio={progressRatio}
        targetMinutes={habit.targetMinutes ?? 25}
        onCompleteEarly={handleCompleteEarly}
        onToggleEarlyConfirm={handleToggleEarlyConfirm}
        onCancelTimer={handleCancelTimer}
        onConfirmEarly={handleConfirmEarly}
        onCancelEarlyConfirm={handleCancelEarlyConfirm}
        onEndedComplete={handleEndedComplete}
        onStartFocus={handleStartFocusClick}
        onStopCardClick={stopCardClick}
      />

      {!running && !ended && (
        <HabitRowFooter
          t={t}
          done={done}
          doneByQuotaOnly={doneByQuotaOnly}
          isRestDay={isRestDay}
          streak={streak}
          onPillClick={handleFooterPillClick}
        />
      )}

      <HabitRowDialogs
        t={t}
        habitName={habit.name}
        confirmDelete={confirmDelete}
        showUndoConfirm={showUndoConfirm}
        onCancelDelete={() => setConfirmDelete(false)}
        onConfirmDelete={handleConfirmDelete}
        onCancelUndo={() => setShowUndoConfirm(false)}
        onConfirmUndo={handleConfirmUndo}
      />
    </div>
  )
})
