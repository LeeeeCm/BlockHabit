import { useState } from 'react'
import type { CheckInResult, Habit } from '../types'
import { useAppStore } from '../store/appStore'
import { weekCountFor } from '../logic/checkin'
import { IconDone, IconEdit, IconMissed, IconTodo, IconTrash } from './Icons'

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

/** 双列大卡片：单击打卡，右上角编辑 / 删除（删除需二次确认） */
export function HabitRow({ habit, done, streak, day, onCheck, onEdit }: Props) {
  const checkIn = useAppStore((s) => s.checkIn)
  const deleteHabit = useAppStore((s) => s.deleteHabit)
  const checkIns = useAppStore((s) => s.checkIns)
  const [pulse, setPulse] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const missed = !done && weekMissed(habit, checkIns, day)

  const freqLabel =
    habit.frequency.type === 'daily' ? '每天' : `每周 ${habit.frequency.times} 次`
  const meta = [freqLabel, PERIOD_LABEL[habit.period ?? 'any'], habit.targetMinutes ? `${habit.targetMinutes} 分钟` : '']
    .filter(Boolean)
    .join(' · ')

  function handleClick() {
    const res = checkIn(habit.id)
    if (res.reason === undefined) {
      setPulse(true)
      setTimeout(() => setPulse(false), 300)
    }
    onCheck?.(res)
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 2600)
      return
    }
    deleteHabit(habit.id)
  }

  return (
    <div
      className="card habit-card"
      style={{
        opacity: done ? 0.92 : 1,
        borderColor: done ? 'color-mix(in srgb, var(--accent) 55%, var(--line))' : undefined,
        background: done ? 'color-mix(in srgb, var(--accent) 7%, var(--surface))' : undefined,
        transition: 'transform 0.16s ease, background 0.2s ease, border-color 0.2s ease',
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        handleClick()
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleClick()
          }}
          title={done ? '已完成' : missed ? '本周已无法达标' : '标记完成'}
          style={{
            width: 34,
            height: 34,
            color: done ? 'var(--accent)' : 'var(--ink-2)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.28s cubic-bezier(0.34,1.5,0.64,1)',
            transform: pulse ? 'scale(1.25) rotate(90deg)' : 'scale(1) rotate(0deg)',
          }}
        >
          {done ? <IconDone size={30} /> : missed ? <IconMissed size={30} /> : <IconTodo size={30} />}
        </button>

        <div style={{ display: 'flex', gap: 2 }}>
          <button
            className="card-action"
            title="编辑"
            onClick={(e) => {
              e.stopPropagation()
              onEdit?.()
            }}
          >
            <IconEdit size={17} />
          </button>
          <button
            className="card-action danger"
            title={confirming ? '再点一次确认删除' : '删除'}
            onClick={handleDelete}
            style={confirming ? { color: 'var(--accent-ink)', background: 'var(--accent)' } : undefined}
          >
            {confirming ? <span style={{ fontSize: 12, fontWeight: 600 }}>确认?</span> : <IconTrash size={17} />}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 16.5, fontWeight: 600, lineHeight: 1.35, marginTop: 6, wordBreak: 'break-word' }}>
        {habit.name}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>{meta}</div>
      {habit.note ? (
        <div style={{ fontSize: 12, color: 'var(--ink-2)', opacity: 0.75, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {habit.note}
        </div>
      ) : null}

      <div style={{ marginTop: 'auto', paddingTop: 10 }}>
        {streak > 0 ? (
          <span
            style={{
              fontSize: 12,
              color: streak % 7 === 0 ? 'var(--accent-ink)' : 'var(--ink-2)',
              background: streak % 7 === 0 ? 'var(--accent)' : 'var(--bg)',
              border: streak % 7 === 0 ? 'none' : '1px solid var(--line)',
              borderRadius: 999,
              padding: '3px 11px',
              fontWeight: streak % 7 === 0 ? 600 : 400,
            }}
          >
            连续 {streak} 天
          </span>
        ) : (
          <span style={{ fontSize: 11.5, color: 'var(--ink-2)', opacity: 0.6 }}>今天开始第一块吧</span>
        )}
      </div>
    </div>
  )
}
