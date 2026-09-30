import { useState } from 'react'
import type { Habit, HabitFrequency, HabitKind, HabitPeriod } from '../types'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import { IconClose, IconOptional, IconRequired } from './Icons'
import { triggerHaptic, usePlatform } from '../platform'
import { BottomSheet } from './BottomSheet'
import { useDialogA11y } from './useDialogA11y'
interface Props {
  habit?: Habit
  onClose: () => void
}


/** 字段标签：必填 = 绿色实心小方块；选填 = 灰色空心小方块 + 「选填」 */
function FieldLabel({ required, optionalText, children }: { required?: boolean; optionalText: string; children: string }) {
  return (
    <label>
      {required ? <IconRequired /> : <IconOptional />}
      <span style={required ? { color: 'var(--ink)', fontWeight: 600 } : undefined}>{children}</span>
      {!required && (
        <span
          style={{
            fontSize: 10.5,
            border: '1px solid var(--line)',
            borderRadius: 999,
            padding: '1px 7px',
            color: 'var(--ink-2)',
          }}
        >
          {optionalText}
        </span>
      )}
    </label>
  )
}

export function HabitDialog({ habit, onClose }: Props) {
  const { t } = useI18n()
  const { isMobile } = usePlatform()
  const addHabit = useAppStore((s) => s.addHabit)
  const updateHabit = useAppStore((s) => s.updateHabit)
  const archiveHabit = useAppStore((s) => s.archiveHabit)
  const [kind, setKind] = useState<HabitKind>(habit?.kind ?? (habit?.targetMinutes ? 'focus' : habit?.targetValue ? 'counter' : 'instant'))
  const [name, setName] = useState(habit?.name ?? '')
  const [targetValue, setTargetValue] = useState(habit?.targetValue ? String(habit.targetValue) : '2000')
  const [unit, setUnit] = useState(habit?.unit ?? 'ml')
  const [step, setStep] = useState(habit?.step ? String(habit.step) : '250')
  const [category, setCategory] = useState(habit?.category ?? '')
  const [freqMode, setFreqMode] = useState<'daily' | 'custom' | 'weekly'>(
    habit?.frequency.type ?? 'daily',
  )
  const [customDays, setCustomDays] = useState<number[]>(
    habit?.frequency.type === 'custom' ? habit.frequency.days : [1, 2, 3, 4, 5],
  )
  const [times, setTimes] = useState(habit?.frequency.type === 'weekly' ? habit.frequency.times : 3)
  const [period, setPeriod] = useState<HabitPeriod>(habit?.period ?? 'any')
  const [minutes, setMinutes] = useState(habit?.targetMinutes ? String(habit.targetMinutes) : '25')
  const [note, setNote] = useState(habit?.note ?? '')

  const editing = Boolean(habit)
  const minutesNum = parseInt(minutes, 10)
  const minutesValid = Number.isFinite(minutesNum) && minutesNum >= 1 && minutesNum <= 480
  const targetValNum = parseInt(targetValue, 10)
  const targetValValid = Number.isFinite(targetValNum) && targetValNum >= 1
  const stepNum = parseInt(step, 10)
  const stepValid = Number.isFinite(stepNum) && stepNum >= 1
  const freqValid = freqMode !== 'custom' || customDays.length > 0
  const canSave =
    Boolean(name.trim()) &&
    freqValid &&
    (kind === 'instant' || (kind === 'focus' && minutesValid) || (kind === 'counter' && targetValValid && stepValid))
  const { ref: dialogRef } = useDialogA11y({ open: true, onClose })

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
      targetMinutes: kind === 'focus' && minutesValid ? minutesNum : undefined,
      targetValue: kind === 'counter' && targetValValid ? targetValNum : undefined,
      unit: kind === 'counter' ? (unit.trim() || undefined) : undefined,
      step: kind === 'counter' && stepValid ? stepNum : undefined,
      category: category.trim() || undefined,
      note: note.trim() || undefined,
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
      <button className="btn ghost" onClick={onClose}>
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
          <FieldLabel required optionalText={t.common.optional}>{t.habitDialog.typeLabel}</FieldLabel>
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
          <FieldLabel required optionalText={t.common.optional}>{t.habitDialog.nameLabel}</FieldLabel>
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
          <FieldLabel required optionalText={t.common.optional}>{t.habitDialog.freqLabel}</FieldLabel>
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
                  style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 999 }}
                  onClick={() => setCustomDays([1, 2, 3, 4, 5])}
                >
                  {t.habitDialog.selectWorkdays}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 999 }}
                  onClick={() => setCustomDays([6, 7])}
                >
                  {t.habitDialog.selectWeekends}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 999 }}
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
                          prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                        )
                      }}
                      style={{
                        flex: 1,
                        height: 34,
                        borderRadius: 8,
                        border: active ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                        background: active ? 'var(--ink)' : 'var(--bg)',
                        color: active ? 'var(--bg)' : 'var(--ink-2)',
                        fontSize: 13,
                        fontWeight: active ? 700 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {customDays.length === 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>
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
                onChange={(e) => setTimes(Number(e.target.value))}
                style={{ accentColor: 'var(--progress-green)', flex: 1 }}
              />
              <span style={{ fontSize: 13, minWidth: 60, textAlign: 'right' }}>{t.habitDialog.timesPerWeek(times)}</span>
            </div>
          )}
        </div>

        <div className="field">
          <FieldLabel optionalText={t.common.optional}>{t.habitDialog.periodLabel}</FieldLabel>
          <div className="seg">
            {(['any', 'morning', 'afternoon', 'evening'] as const).map((p) => (
              <button key={p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>
                {t.today.periods[p]}
              </button>
            ))}
          </div>
        </div>

        {kind === 'focus' && (
          <div className="field">
            <FieldLabel required optionalText={t.common.optional}>{t.habitDialog.durationLabel}</FieldLabel>
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
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{t.habitDialog.durationUnit}</span>
            </div>
          </div>
        )}

        {kind === 'counter' && (
          <div className="field">
            <FieldLabel required optionalText={t.common.optional}>{t.habitDialog.counterTarget}</FieldLabel>
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
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
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
  )

  if (isMobile) {
    return (
      <BottomSheet open={true} onClose={onClose} title={title} footer={footerContent}>
        {formContent}
      </BottomSheet>
    )
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dialog habit-dialog" onMouseDown={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '92vw' }}>
        <div className="dialog-header">
          <h3>{title}</h3>
          <button
            className="icon-btn"
            onClick={() => {
              triggerHaptic('light')
              onClose()
            }}
            title={t.common.close}
          >
            <IconClose size={18} />
          </button>
        </div>

        <div className="dialog-body">
          {formContent}
        </div>

        {footerContent}
      </div>
    </div>
  )
}
