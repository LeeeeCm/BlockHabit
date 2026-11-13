import { useRef, useState } from 'react'
import type { Habit, HabitFrequency, HabitKind, HabitPeriod } from '../types'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import { suggestedReminderStart } from '../logic/reminderScheduler'
import { playSnapSound } from '../audio/sound'
import { IconClose, IconOptional, IconRequired } from './Icons'
import { triggerHaptic, usePlatform } from '../platform'
import { BottomSheet } from './BottomSheet'
import { useDialogA11y } from './useDialogA11y'
import { ConfirmDialog } from './ConfirmDialog'
interface Props {
  habit?: Habit
  onClose: () => void
}

/** 字段标签：必填 = 绿色实心小方块；选填 = 灰色空心小方块 + 「选填」 */
function FieldLabel({
  required,
  optionalText,
  children
}: {
  required?: boolean
  optionalText: string
  children: string
}) {
  return (
    <label>
      {required ? <IconRequired /> : <IconOptional />}
      <span style={required ? { color: 'var(--ink)', fontWeight: 600 } : undefined}>
        {children}
      </span>
      {!required && (
        <span
          style={{
            fontSize: 'var(--fs-caption)',
            border: '1px solid var(--line)',
            borderRadius: 999,
            padding: '1px 7px',
            color: 'var(--ink-2)'
          }}
        >
          {optionalText}
        </span>
      )}
    </label>
  )
}

/** "HH:mm" + 分钟步进 → 下一个合法 "HH:mm"（分钟按 15 分钟栅格回绕） */
function shiftHHmm(value: string, dHour: number, dMinute: number): string {
  const [h, m] = value.split(':').map(Number)
  const nh = (((h + dHour) % 24) + 24) % 24
  const nm = (((m + dMinute) % 60) + 60) % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

/** "HH:mm" + n 分钟 → "HH:mm"，封顶 23:59（跨午夜不支持） */
export function plusMinutes(value: string, n: number): string {
  const [h, m] = value.split(':').map(Number)
  const total = Math.min(23 * 60 + 59, h * 60 + m + n)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** 积木风时间步进器：小时 ±1 / 分钟 ±15，方块按钮带咬合音效 */
function TimeStepper({
  value,
  onChange,
  ariaLabel
}: {
  value: string
  onChange: (v: string) => void
  ariaLabel: string
}) {
  const [hh, mm] = value.split(':')
  const step = (dHour: number, dMinute: number) => {
    playSnapSound()
    onChange(shiftHHmm(value, dHour, dMinute))
  }
  return (
    <div className="time-stepper" role="group" aria-label={ariaLabel}>
      <div className="ts-part">
        <button
          type="button"
          className="ts-btn"
          aria-label={`${ariaLabel} -1h`}
          onClick={() => step(-1, 0)}
        >
          −
        </button>
        <span className="ts-num">{hh}</span>
        <button
          type="button"
          className="ts-btn"
          aria-label={`${ariaLabel} +1h`}
          onClick={() => step(1, 0)}
        >
          +
        </button>
      </div>
      <span className="ts-colon">:</span>
      <div className="ts-part">
        <button
          type="button"
          className="ts-btn"
          aria-label={`${ariaLabel} -15m`}
          onClick={() => step(0, -15)}
        >
          −
        </button>
        <span className="ts-num">{mm}</span>
        <button
          type="button"
          className="ts-btn"
          aria-label={`${ariaLabel} +15m`}
          onClick={() => step(0, 15)}
        >
          +
        </button>
      </div>
    </div>
  )
}

export function HabitDialog({ habit, onClose }: Props) {
  const { t } = useI18n()
  const { isMobile } = usePlatform()
  const addHabit = useAppStore((s) => s.addHabit)
  const updateHabit = useAppStore((s) => s.updateHabit)
  const archiveHabit = useAppStore((s) => s.archiveHabit)
  const [kind, setKind] = useState<HabitKind>(
    habit?.kind ?? (habit?.targetMinutes ? 'focus' : habit?.targetValue ? 'counter' : 'instant')
  )
  const [name, setName] = useState(habit?.name ?? '')
  const [targetValue, setTargetValue] = useState(
    habit?.targetValue ? String(habit.targetValue) : '2000'
  )
  const [unit, setUnit] = useState(habit?.unit ?? 'ml')
  const [step, setStep] = useState(habit?.step ? String(habit.step) : '250')
  const [category, setCategory] = useState(habit?.category ?? '')
  const [freqMode, setFreqMode] = useState<'daily' | 'custom' | 'weekly'>(
    habit?.frequency.type ?? 'daily'
  )
  const [customDays, setCustomDays] = useState<number[]>(
    habit?.frequency.type === 'custom' ? habit.frequency.days : [1, 2, 3, 4, 5]
  )
  const [times, setTimes] = useState(habit?.frequency.type === 'weekly' ? habit.frequency.times : 3)
  const [period, setPeriod] = useState<HabitPeriod>(habit?.period ?? 'any')
  const [reminderOn, setReminderOn] = useState(Boolean(habit?.reminder))
  const [remStart, setRemStart] = useState(
    habit?.reminder?.start ?? suggestedReminderStart(habit?.period ?? 'any', new Date())
  )
  const [remEnd, setRemEnd] = useState<string | null>(habit?.reminder?.end ?? null)
  const [minutes, setMinutes] = useState(habit?.targetMinutes ? String(habit.targetMinutes) : '25')
  const [note, setNote] = useState(habit?.note ?? '')
  /**
   * F1 下半：把「时段 / 提醒 / 分类 / 备注」四组选填项默认折叠。
   * 编辑一个已经填过这些字段的习惯时自动展开，避免「看不见但还在」的困惑。
   */
  const [moreOpen, setMoreOpen] = useState(
    Boolean(habit?.period && habit.period !== 'any') ||
      Boolean(habit?.reminder) ||
      Boolean(habit?.category) ||
      Boolean(habit?.note)
  )

  // C9：关闭保护 —— 表单有任何改动时，Esc / 点遮罩 / 取消 / 右上角 × 都要先确认，
  // 避免半填的习惯信息被一次误触清空（同为破坏性操作，与撤销打卡的保护级别对齐）。
  const formSnapshot = JSON.stringify({
    kind,
    name,
    targetValue,
    unit,
    step,
    category,
    freqMode,
    customDays,
    times,
    period,
    reminderOn,
    remStart,
    remEnd,
    minutes,
    note
  })
  const initialSnapshotRef = useRef<string | null>(null)
  if (initialSnapshotRef.current === null) initialSnapshotRef.current = formSnapshot
  const dirty = formSnapshot !== initialSnapshotRef.current
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const requestClose = () => {
    if (!dirty) {
      onClose()
      return
    }
    setDiscardConfirmOpen(true)
  }

  const editing = Boolean(habit)
  const minutesNum = parseInt(minutes, 10)
  const minutesValid = Number.isFinite(minutesNum) && minutesNum >= 1 && minutesNum <= 480
  const targetValNum = parseInt(targetValue, 10)
  const targetValValid = Number.isFinite(targetValNum) && targetValNum >= 1
  const stepNum = parseInt(step, 10)
  const stepValid = Number.isFinite(stepNum) && stepNum >= 1
  const freqValid = freqMode !== 'custom' || customDays.length > 0
  const reminderValid = !reminderOn || !remEnd || remEnd > remStart
  const canSave =
    Boolean(name.trim()) &&
    freqValid &&
    reminderValid &&
    (kind === 'instant' ||
      (kind === 'focus' && minutesValid) ||
      (kind === 'counter' && targetValValid && stepValid))
  const { ref: dialogRef } = useDialogA11y({
    open: true,
    onClose: requestClose,
    enabled: !discardConfirmOpen
  })

  function save() {
    const trimmed = name.trim()
    if (!trimmed || !canSave) return
    const frequency: HabitFrequency =
      freqMode === 'daily'
        ? { type: 'daily' }
        : freqMode === 'custom'
          ? { type: 'custom', days: [...customDays].sort((a, b) => a - b) }
          : { type: 'weekly', times }
    const extra = {
      kind,
      period,
      reminder: reminderOn ? { start: remStart, end: remEnd ?? undefined } : undefined,
      targetMinutes: kind === 'focus' && minutesValid ? minutesNum : undefined,
      targetValue: kind === 'counter' && targetValValid ? targetValNum : undefined,
      unit: kind === 'counter' ? unit.trim() || undefined : undefined,
      step: kind === 'counter' && stepValid ? stepNum : undefined,
      category: category.trim() || undefined,
      note: note.trim() || undefined
    }
    if (editing && habit) {
      updateHabit(habit.id, { name: trimmed, frequency, ...extra })
    } else {
      addHabit(trimmed, frequency, extra)
    }
    triggerHaptic('success')
    onClose()
  }
  const title = editing ? t.habitDialog.editTitle : t.habitDialog.newTitle

  const footerContent = (
    <div className="dialog-footer" style={{ borderTop: 'none', padding: 0 }}>
      {editing && (
        <button
          className="btn ghost"
          style={{ marginRight: 'auto' }}
          onClick={() => {
            triggerHaptic('warning')
            archiveHabit(habit!.id)
            onClose()
          }}
        >
          {t.habitDialog.archiveBtn}
        </button>
      )}
      <button className="btn ghost" onClick={requestClose}>
        {t.common.cancel}
      </button>
      <button className="btn primary" disabled={!canSave} onClick={save}>
        {t.common.save}
      </button>
    </div>
  )

  const formContent = (
    <>
      <div className="field">
        <FieldLabel required optionalText={t.common.optional}>
          {t.habitDialog.typeLabel}
        </FieldLabel>
        <div className="seg">
          <button className={kind === 'instant' ? 'active' : ''} onClick={() => setKind('instant')}>
            {t.habitDialog.instant}
          </button>
          <button className={kind === 'focus' ? 'active' : ''} onClick={() => setKind('focus')}>
            {t.habitDialog.focus}
          </button>
          <button className={kind === 'counter' ? 'active' : ''} onClick={() => setKind('counter')}>
            {t.habitDialog.counter}
          </button>
        </div>
      </div>

      <div className="field">
        <FieldLabel required optionalText={t.common.optional}>
          {t.habitDialog.nameLabel}
        </FieldLabel>
        <input
          type="text"
          autoFocus
          value={name}
          placeholder={
            kind === 'instant'
              ? t.habitDialog.placeholderInstant
              : kind === 'focus'
                ? t.habitDialog.placeholderFocus
                : t.habitDialog.placeholderCounter
          }
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </div>
      <div className="field">
        <FieldLabel required optionalText={t.common.optional}>
          {t.habitDialog.freqLabel}
        </FieldLabel>
        <div className="seg">
          <button
            type="button"
            className={freqMode === 'daily' ? 'active' : ''}
            onClick={() => setFreqMode('daily')}
          >
            {t.habitDialog.freqDaily}
          </button>
          <button
            type="button"
            className={freqMode === 'custom' ? 'active' : ''}
            onClick={() => setFreqMode('custom')}
          >
            {t.habitDialog.freqCustom}
          </button>
          <button
            type="button"
            className={freqMode === 'weekly' ? 'active' : ''}
            onClick={() => setFreqMode('weekly')}
          >
            {t.habitDialog.freqWeekly}
          </button>
        </div>

        {freqMode === 'custom' && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button
                type="button"
                className="btn ghost"
                style={{ fontSize: 'var(--fs-small)', padding: '3px 8px', borderRadius: 999 }}
                onClick={() => setCustomDays([1, 2, 3, 4, 5])}
              >
                {t.habitDialog.selectWorkdays}
              </button>
              <button
                type="button"
                className="btn ghost"
                style={{ fontSize: 'var(--fs-small)', padding: '3px 8px', borderRadius: 999 }}
                onClick={() => setCustomDays([6, 7])}
              >
                {t.habitDialog.selectWeekends}
              </button>
              <button
                type="button"
                className="btn ghost"
                style={{ fontSize: 'var(--fs-small)', padding: '3px 8px', borderRadius: 999 }}
                onClick={() => setCustomDays([1, 2, 3, 4, 5, 6, 7])}
              >
                {t.habitDialog.selectAll}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const label = t.common.weekdaysSingle[d - 1]
                const active = customDays.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setCustomDays((prev) =>
                        prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                      )
                    }}
                    style={{
                      flex: 1,
                      height: 34,
                      borderRadius: 8,
                      border: active ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                      background: active ? 'var(--ink)' : 'var(--bg)',
                      color: active ? 'var(--bg)' : 'var(--ink-2)',
                      fontSize: 'var(--fs-body)',
                      fontWeight: active ? 700 : 400,
                      cursor: 'pointer',
                      transition: 'all var(--dur-xs) var(--ease-default)'
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {customDays.length === 0 && (
              <div style={{ fontSize: 'var(--fs-small)', color: 'var(--danger)', marginTop: 4 }}>
                {t.habitDialog.selectAtLeastOne}
              </div>
            )}
          </div>
        )}

        {freqMode === 'weekly' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <input
              type="range"
              min={1}
              max={7}
              value={times}
              aria-label={t.habitDialog.timesPerWeek(times)}
              onChange={(e) => setTimes(Number(e.target.value))}
              style={{ accentColor: 'var(--ink)', flex: 1 }}
            />
            <span style={{ fontSize: 'var(--fs-body)', minWidth: 60, textAlign: 'right' }}>
              {t.habitDialog.timesPerWeek(times)}
            </span>
          </div>
        )}
      </div>

      {/* F1 下半：选填项默认折叠，首屏只留「名称 / 频率 / 目标」 */}
      <button
        type="button"
        className="btn ghost"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderRadius: 'var(--r-md)',
          fontSize: 'var(--fs-small)',
          color: 'var(--ink-2)'
        }}
      >
        <span>{moreOpen ? t.habitDialog.fewerSettings : t.habitDialog.moreSettings}</span>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            transition: 'transform var(--dur-xs) var(--ease-default)',
            transform: moreOpen ? 'rotate(180deg)' : 'none'
          }}
        >
          ⌄
        </span>
      </button>

      {moreOpen && (
        <>
          <div className="field">
            <FieldLabel optionalText={t.common.optional}>{t.habitDialog.periodLabel}</FieldLabel>
            <div className="seg">
              {(['any', 'morning', 'afternoon', 'evening'] as const).map((p) => (
                <button
                  key={p}
                  className={period === p ? 'active' : ''}
                  onClick={() => setPeriod(p)}
                >
                  {t.today.periods[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <FieldLabel optionalText={t.common.optional}>{t.habitDialog.reminderLabel}</FieldLabel>
            <div className="seg">
              <button
                type="button"
                className={!reminderOn ? 'active' : ''}
                onClick={() => setReminderOn(false)}
              >
                {t.habitDialog.reminderOff}
              </button>
              <button
                type="button"
                className={reminderOn ? 'active' : ''}
                onClick={() => {
                  setReminderOn(true)
                  // 首次开启时按当前时段给建议时刻（编辑已有提醒则保留原值）
                  if (!habit?.reminder && !remEnd) {
                    setRemStart(suggestedReminderStart(period, new Date()))
                  }
                }}
              >
                {t.habitDialog.reminderOn}
              </button>
            </div>
            {reminderOn && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontSize: 'var(--fs-body)',
                      color: 'var(--ink-2)',
                      width: 48,
                      flexShrink: 0
                    }}
                  >
                    {t.habitDialog.reminderStart}
                  </span>
                  <TimeStepper
                    value={remStart}
                    onChange={setRemStart}
                    ariaLabel={t.habitDialog.reminderStart}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontSize: 'var(--fs-body)',
                      color: 'var(--ink-2)',
                      width: 48,
                      flexShrink: 0
                    }}
                  >
                    {t.habitDialog.reminderEnd}
                  </span>
                  {remEnd ? (
                    <>
                      <TimeStepper
                        value={remEnd}
                        onChange={setRemEnd}
                        ariaLabel={t.habitDialog.reminderEnd}
                      />
                      <button
                        type="button"
                        className="btn ghost"
                        style={{
                          fontSize: 'var(--fs-caption)',
                          padding: '2px 8px',
                          borderRadius: 999
                        }}
                        title={t.common.cancel}
                        onClick={() => setRemEnd(null)}
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn ghost"
                      style={{
                        fontSize: 'var(--fs-small)',
                        padding: '3px 10px',
                        borderRadius: 999
                      }}
                      onClick={() => setRemEnd(plusMinutes(remStart, 90))}
                    >
                      + {t.habitDialog.reminderEnd}
                    </button>
                  )}
                </div>
                <div
                  style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)', lineHeight: 1.5 }}
                >
                  {t.habitDialog.reminderHint}
                </div>
                {remEnd && remEnd <= remStart && (
                  <div style={{ fontSize: 'var(--fs-small)', color: 'var(--danger)' }}>
                    {t.habitDialog.reminderEndInvalid}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {kind === 'focus' && (
        <div className="field">
          <FieldLabel required optionalText={t.common.optional}>
            {t.habitDialog.durationLabel}
          </FieldLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number"
              min={1}
              max={480}
              value={minutes}
              placeholder="25"
              onChange={(e) => setMinutes(e.target.value)}
              style={{ width: 110 }}
            />
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-2)' }}>
              {t.habitDialog.durationUnit}
            </span>
          </div>
        </div>
      )}

      {kind === 'counter' && (
        <div className="field">
          <FieldLabel required optionalText={t.common.optional}>
            {t.habitDialog.counterTarget}
          </FieldLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number"
              min={1}
              value={targetValue}
              placeholder="2000"
              onChange={(e) => setTargetValue(e.target.value)}
              style={{ width: 110 }}
            />
            <input
              type="text"
              value={unit}
              placeholder={t.habitDialog.counterUnit}
              onChange={(e) => setUnit(e.target.value)}
              style={{ width: 70 }}
            />
            <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>
              {t.habitDialog.counterStep}:
            </span>
            <input
              type="number"
              min={1}
              value={step}
              placeholder="250"
              onChange={(e) => setStep(e.target.value)}
              style={{ width: 80 }}
            />
          </div>
        </div>
      )}

      {moreOpen && (
        <>
          <div className="field">
            <FieldLabel optionalText={t.common.optional}>{t.habitDialog.categoryLabel}</FieldLabel>
            <input
              type="text"
              value={category}
              placeholder={t.habitDialog.categoryPlaceholder}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="field">
            <FieldLabel optionalText={t.common.optional}>{t.habitDialog.noteLabel}</FieldLabel>
            <textarea
              value={note}
              placeholder={t.habitDialog.notePlaceholder}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </>
      )}
    </>
  )

  const discardDialog = discardConfirmOpen ? (
    <ConfirmDialog
      title={t.habitDialog.discardTitle}
      message={t.habitDialog.discardMsg}
      confirmLabel={t.habitDialog.discardAction}
      cancelLabel={t.common.cancel}
      danger
      onConfirm={() => {
        setDiscardConfirmOpen(false)
        onClose()
      }}
      onCancel={() => setDiscardConfirmOpen(false)}
    />
  ) : null

  if (isMobile) {
    return (
      <>
        <BottomSheet open={true} onClose={requestClose} title={title} footer={footerContent}>
          {formContent}
        </BottomSheet>
        {discardDialog}
      </>
    )
  }

  return (
    <>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-dialog-title"
        tabIndex={-1}
        className="overlay"
        onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
      >
        <div
          className="dialog habit-dialog"
          onMouseDown={(e) => e.stopPropagation()}
          style={{ width: 460, maxWidth: '92vw' }}
        >
          <div className="dialog-header">
            <h3 id="habit-dialog-title">{title}</h3>
            <button
              className="icon-btn"
              onClick={() => {
                triggerHaptic('light')
                requestClose()
              }}
              title={t.common.close}
            >
              <IconClose size={18} />
            </button>
          </div>

          <div className="dialog-body">{formContent}</div>

          {footerContent}
        </div>
      </div>
      {discardDialog}
    </>
  )
}
