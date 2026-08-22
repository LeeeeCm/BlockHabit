import { useState } from 'react'
import type { CheckInResult, Habit } from '../types'
import { useAppStore } from '../store/appStore'
import { weekCountFor } from '../logic/checkin'
import { IconDone, IconMissed, IconTodo } from './Icons'

interface Props {
  habit: Habit
  done: boolean
  streak: number
  day: string
  onCheck?: (res: CheckInResult) => void
  onEdit?: () => void
}

const PERIOD_LABEL: Record<string, string> = {
  any: '',
  morning: '早晨',
  afternoon: '午后',
  evening: '夜晚',
}

/** 周频习惯本周是否已无法达标（剩余天数 < 还需次数） */
function weekMissed(habit: Habit, checkIns: import('../types').CheckIn[], day: string): boolean {
  if (habit.frequency.type !== 'weekly') return false
  const need = habit.frequency.times - weekCountFor(checkIns, habit.id, day)
  if (need <= 0) return false
  const d = new Date(day + 'T00:00:00')
  const daysLeft = 7 - ((d.getDay() + 6) % 7)
  return need > daysLeft
}

export function HabitRow({ habit, done, streak, day, onCheck, onEdit }: Props) {
  const checkIn = useAppStore((s) => s.checkIn)
  const checkIns = useAppStore((s) => s.checkIns)
  const [pulse, setPulse] = useState(false)

  const missed = !done && weekMissed(habit, checkIns, day)

  const freqLabel =
    habit.frequency.type === 'daily' ? '每天' : `每周 ${habit.frequency.times} 次`
  const meta = [freqLabel, PERIOD_LABEL[habit.period ?? 'any'], habit.targetMinutes ? `${habit.targetMinutes} 分钟` : '']
    .filter(Boolean)
    .join(' · ')

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
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        marginBottom: 10,
        cursor: 'pointer',
        transition: 'box-shadow 0.15s ease',
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        handleClick()
      }}
      onDoubleClick={() => onEdit?.()}
      title="单击打卡 · 双击编辑"
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleClick()
        }}
        title={done ? '今日已完成' : missed ? '本周已无法达标' : '打卡'}
        style={{
          width: 30,
          height: 30,
          flex: 'none',
          color: done ? 'var(--accent)' : missed ? 'var(--ink-2)' : 'var(--ink-2)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.28s cubic-bezier(0.34,1.5,0.64,1)',
          transform: pulse ? 'scale(1.3) rotate(90deg)' : 'scale(1) rotate(0deg)',
        }}
      >
        {done ? <IconDone size={26} /> : missed ? <IconMissed size={26} /> : <IconTodo size={26} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15 }}>{habit.name}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          {meta}
          {habit.note ? <span style={{ opacity: 0.8 }}> · {habit.note}</span> : ''}
        </div>
      </div>

      {streak > 0 && (
        <span
          style={{
            fontSize: 12,
            color: streak % 7 === 0 ? 'var(--accent-ink)' : 'var(--ink-2)',
            background: streak % 7 === 0 ? 'var(--accent)' : 'transparent',
            border: streak % 7 === 0 ? 'none' : '1px solid var(--line)',
            borderRadius: 999,
            padding: '3px 10px',
            flex: 'none',
            fontWeight: streak % 7 === 0 ? 600 : 400,
          }}
        >
          连续 {streak} 天
        </span>
      )}
    </div>
  )
}
