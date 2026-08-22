import { useState } from 'react'
import type { Habit } from '../types'
import { useAppStore } from '../store/appStore'

interface Props {
  habit?: Habit
  onClose: () => void
}

export function HabitDialog({ habit, onClose }: Props) {
  const addHabit = useAppStore((s) => s.addHabit)
  const updateHabit = useAppStore((s) => s.updateHabit)
  const archiveHabit = useAppStore((s) => s.archiveHabit)

  const [name, setName] = useState(habit?.name ?? '')
  const [freqType, setFreqType] = useState<'daily' | 'weekly'>(habit?.frequency.type ?? 'daily')
  const [times, setTimes] = useState(habit?.frequency.type === 'weekly' ? habit.frequency.times : 3)

  const editing = Boolean(habit)

  function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    const frequency =
      freqType === 'daily'
        ? ({ type: 'daily' } as const)
        : ({ type: 'weekly', times } as const)
    if (editing && habit) {
      updateHabit(habit.id, { name: trimmed, frequency })
    } else {
      addHabit(trimmed, frequency)
    }
    onClose()
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{editing ? '编辑习惯' : '新建习惯'}</h3>

        <div className="field">
          <label>名称</label>
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
          <label>频率</label>
          <div className="seg">
            <button className={freqType === 'daily' ? 'active' : ''} onClick={() => setFreqType('daily')}>
              每天
            </button>
            <button className={freqType === 'weekly' ? 'active' : ''} onClick={() => setFreqType('weekly')}>
              每周
            </button>
          </div>
        </div>

        {freqType === 'weekly' && (
          <div className="field">
            <label>每周目标：{times} 次</label>
            <input
              type="range"
              min={1}
              max={7}
              value={times}
              onChange={(e) => setTimes(Number(e.target.value))}
              style={{ accentColor: 'var(--accent)' }}
            />
          </div>
        )}

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
          <button className="btn primary" disabled={!name.trim()} onClick={save}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
