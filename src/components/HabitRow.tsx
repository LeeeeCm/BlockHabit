import { useState } from 'react'
import type { CheckInResult, Habit } from '../types'
import { useAppStore } from '../store/appStore'

interface Props {
  habit: Habit
  done: boolean
  streak: number
  onCheck?: (res: CheckInResult) => void
}

export function HabitRow({ habit, done, streak, onCheck }: Props) {
  const checkIn = useAppStore((s) => s.checkIn)
  const [pulse, setPulse] = useState(false)

  const freqLabel =
    habit.frequency.type === 'daily' ? '每天' : `每周 ${habit.frequency.times} 次`

  function handleClick() {
    const res = checkIn(habit.id)
    if (res.placed) {
      setPulse(true)
      setTimeout(() => setPulse(false), 300)
    }
    onCheck?.(res)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 4px',
        borderBottom: '1px solid var(--line)',
        opacity: done ? 0.9 : 1,
      }}
    >
      <button
        onClick={handleClick}
        title={done ? '今日已完成' : '打卡'}
        style={{
          width: 26,
          height: 26,
          flex: 'none',
          border: done ? 'none' : '1.5px solid var(--ink-2)',
          borderRadius: '50%',
          background: done ? 'var(--accent)' : 'transparent',
          color: 'var(--accent-ink)',
          fontWeight: 700,
          fontSize: 15,
          lineHeight: 1,
          transition: 'transform 0.24s ease-out, background 0.15s',
          transform: pulse ? 'scale(1.35) rotate(90deg)' : 'scale(1) rotate(0deg)',
        }}
      >
        {done ? '✓' : ''}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15 }}>{habit.name}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{freqLabel}</div>
      </div>

      {streak > 0 && (
        <span
          style={{
            fontSize: 12,
            color: 'var(--ink-2)',
            border: '1px solid var(--line)',
            padding: '2px 8px',
            flex: 'none',
          }}
        >
          连续 {streak} 天
        </span>
      )}
    </div>
  )
}
