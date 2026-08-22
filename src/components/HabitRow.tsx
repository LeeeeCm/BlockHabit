import { useEffect, useState } from 'react'
import type { CheckInResult, Habit } from '../types'
import { useAppStore } from '../store/appStore'
import { useTimerStore } from '../store/timerStore'
import { canCheckIn, weekCountFor } from '../logic/checkin'
import { ConfirmDialog } from './ConfirmDialog'
import {
  IconCancel,
  IconDone,
  IconEdit,
  IconInProgress,
  IconMissed,
  IconTodo,
  IconTrash,
} from './Icons'

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

function fmtRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/**
 * 双列大卡片：
 * 点击未完成卡片 → 开始倒计时（蓝色/进行中）；倒计时到点 → 提醒后再次点击 → 真正打卡（绿色）。
 */
export function HabitRow({ habit, done, streak, day, onCheck, onEdit }: Props) {
  const checkIn = useAppStore((s) => s.checkIn)
  const deleteHabit = useAppStore((s) => s.deleteHabit)
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const session = useTimerStore((s) => s.sessions[habit.id])
  const startTimer = useTimerStore((s) => s.start)
  const cancelTimer = useTimerStore((s) => s.cancel)

  const [pulse, setPulse] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [now, setNow] = useState(Date.now())

  // 倒计时进行中每半秒刷新
  useEffect(() => {
    if (!session) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [session])

  const missed = !done && weekMissed(habit, checkIns, day)
  const targetMs = (habit.targetMinutes ?? 25) * 60_000
  const running = !!session && !done && now - session.startedAt < targetMs
  const ended = !!session && !done && now - session.startedAt >= targetMs

  const freqLabel =
    habit.frequency.type === 'daily' ? '每天' : `每周 ${habit.frequency.times} 次`
  const meta = [freqLabel, PERIOD_LABEL[habit.period ?? 'any'], habit.targetMinutes ? `${habit.targetMinutes} 分钟` : '']
    .filter(Boolean)
    .join(' · ')

  function handleClick() {
    if (done || running) return
    if (ended) {
      // 倒计时已到：这次点击才真正打卡
      const res = checkIn(habit.id)
      cancelTimer(habit.id)
      if (res.reason === undefined) {
        setPulse(true)
        setTimeout(() => setPulse(false), 300)
      }
      onCheck?.(res)
      return
    }
    // 未开始：启动倒计时（今天已打卡/周频已满则不启动）
    const verdict = canCheckIn(habits, checkIns, habit.id, day)
    if (!verdict.ok) return
    startTimer(habit.id, targetMs)
    setPulse(true)
    setTimeout(() => setPulse(false), 300)
  }

  const statusColor = done
    ? 'var(--progress-green)'
    : running || ended
      ? 'var(--progress-blue)'
      : 'var(--ink-2)'

  return (
    <div
      className="card habit-card"
      style={{
        opacity: done ? 0.95 : 1,
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
          className="status-btn"
          onClick={(e) => {
            e.stopPropagation()
            handleClick()
          }}
          title={done ? '已完成' : missed ? '本周已无法达标' : running ? '进行中' : ended ? '计时完成，点击打卡' : '开始倒计时'}
          style={{
            width: 40,
            height: 40,
            color: statusColor,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.28s cubic-bezier(0.34,1.5,0.64,1)',
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

        <div style={{ display: 'flex', gap: 2 }}>
          <button
            className="card-action"
            title="编辑"
            onClick={(e) => {
              e.stopPropagation()
              onEdit?.()
            }}
          >
            <IconEdit size={20} />
          </button>
          <button
            className="card-action danger"
            title="删除"
            onClick={(e) => {
              e.stopPropagation()
              setConfirmDelete(true)
            }}
          >
            <IconTrash size={20} />
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

      {running && (
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span
            className="big-num"
            style={{ fontSize: 22, color: 'var(--progress-blue)', lineHeight: 1 }}
          >
            {fmtRemaining(session ? session.startedAt + targetMs - now : 0)}
          </span>
          <button
            className="card-action danger"
            title="放弃本次计时"
            onClick={(e) => {
              e.stopPropagation()
              cancelTimer(habit.id)
            }}
            style={{ fontSize: 12, width: 'auto', padding: '5px 12px', gap: 5 }}
          >
            <IconCancel size={15} />
            放弃
          </button>
        </div>
      )}
      {ended && (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--progress-blue)', fontWeight: 600 }}>
          计时完成 · 点击打卡
        </div>
      )}
      {!session && !running && !ended && (
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
              fontSize: 12,
              borderRadius: 999,
              padding: '3px 11px',
              fontWeight: 600,
              color: done ? 'var(--accent-ink)' : 'var(--ink-2)',
              background: done ? 'var(--progress-green)' : 'var(--bg)',
              border: done ? 'none' : '1px solid var(--line)',
            }}
          >
            {done ? '今日已完成' : '今日未完成'}
          </span>
          {streak > 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>已连续打卡 {streak} 天</span>
          )}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="删除习惯"
          message={
            <>
              确定要删除「<b>{habit.name}</b>」吗？
              <br />
              它的打卡记录将一并删除，此操作不可恢复。
            </>
          }
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            cancelTimer(habit.id)
            deleteHabit(habit.id)
            setConfirmDelete(false)
          }}
        />
      )}
    </div>
  )
}
