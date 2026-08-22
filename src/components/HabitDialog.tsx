import { useState } from 'react'
import type { Habit, HabitPeriod } from '../types'
import { useAppStore } from '../store/appStore'
import { IconOptional, IconRequired } from './Icons'

interface Props {
  habit?: Habit
  onClose: () => void
}

const PERIODS: Array<{ id: HabitPeriod; label: string }> = [
  { id: 'any', label: '任意' },
  { id: 'morning', label: '早晨' },
  { id: 'afternoon', label: '午后' },
  { id: 'evening', label: '夜晚' },
]

/** 字段标签：必填 = 琥珀实心小方块；选填 = 灰色空心小方块 + 「选填」 */
function FieldLabel({ required, children }: { required?: boolean; children: string }) {
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
          选填
        </span>
      )}
    </label>
  )
}

export function HabitDialog({ habit, onClose }: Props) {
  const addHabit = useAppStore((s) => s.addHabit)
  const updateHabit = useAppStore((s) => s.updateHabit)
  const archiveHabit = useAppStore((s) => s.archiveHabit)

  const [name, setName] = useState(habit?.name ?? '')
  const [freqType, setFreqType] = useState<'daily' | 'weekly'>(habit?.frequency.type ?? 'daily')
  const [times, setTimes] = useState(habit?.frequency.type === 'weekly' ? habit.frequency.times : 3)
  const [period, setPeriod] = useState<HabitPeriod>(habit?.period ?? 'any')
  const [minutes, setMinutes] = useState(habit?.targetMinutes ? String(habit.targetMinutes) : '')
  const [note, setNote] = useState(habit?.note ?? '')

  const editing = Boolean(habit)
  const minutesValid = (() => {
    const m = parseInt(minutes, 10)
    return Number.isFinite(m) && m >= 1 && m <= 480
  })()

  function save() {
    const trimmed = name.trim()
    if (!trimmed || !minutesValid) return
    const frequency =
      freqType === 'daily' ? ({ type: 'daily' } as const) : ({ type: 'weekly', times } as const)
    const extra = {
      period,
      targetMinutes: parseInt(minutes, 10),
      note: note.trim() || undefined,
    }
    if (editing && habit) {
      updateHabit(habit.id, { name: trimmed, frequency, ...extra })
    } else {
      addHabit(trimmed, frequency, extra)
    }
    onClose()
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{editing ? '编辑习惯' : '新建习惯'}</h3>

        <div className="field">
          <FieldLabel required>名称</FieldLabel>
          <input
            type="text"
            autoFocus
            value={name}
            placeholder="例如：读书 30 分钟"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </div>

        <div className="field">
          <FieldLabel required>频率</FieldLabel>
          <div className="seg">
            <button className={freqType === 'daily' ? 'active' : ''} onClick={() => setFreqType('daily')}>
              每天
            </button>
            <button className={freqType === 'weekly' ? 'active' : ''} onClick={() => setFreqType('weekly')}>
              每周
            </button>
          </div>
          {freqType === 'weekly' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <input
                type="range"
                min={1}
                max={7}
                value={times}
                onChange={(e) => setTimes(Number(e.target.value))}
                style={{ accentColor: 'var(--accent)', flex: 1 }}
              />
              <span style={{ fontSize: 13, minWidth: 44, textAlign: 'right' }}>{times} 次 / 周</span>
            </div>
          )}
        </div>

        <div className="field">
          <FieldLabel>时段</FieldLabel>
          <div className="seg">
            {PERIODS.map((p) => (
              <button key={p.id} className={period === p.id ? 'active' : ''} onClick={() => setPeriod(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <FieldLabel required>目标时长</FieldLabel>
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
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>分钟</span>
          </div>
        </div>

        <div className="field">
          <FieldLabel>备注</FieldLabel>
          <textarea
            value={note}
            placeholder="为什么想做这件事？"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="dialog-actions">
          {editing && (
            <button
              className="btn ghost"
              onClick={() => {
                archiveHabit(habit!.id)
                onClose()
              }}
            >
              归档
            </button>
          )}
          <button className="btn ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" disabled={!name.trim() || !minutesValid} onClick={save}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
