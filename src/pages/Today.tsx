import { useMemo, useState } from 'react'
import type { Habit, HabitPeriod } from '../types'
import { useAppStore } from '../store/appStore'
import { todayKey } from '../logic/dates'
import { currentStreak } from '../logic/streak'
import { getBlueprint } from '../logic/blueprints'
import { HabitRow } from '../components/HabitRow'
import { HabitDialog } from '../components/HabitDialog'
import { IconCheck, IconDayCheck, IconPlus } from '../components/Icons'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const PERIOD_ORDER: HabitPeriod[] = ['morning', 'afternoon', 'evening', 'any']
const PERIOD_TITLE: Record<HabitPeriod, string> = {
  morning: '早晨',
  afternoon: '午后',
  evening: '夜晚',
  any: '任意时段',
}

interface Props {
  onCelebrate?: () => void
}

export default function Today({ onCelebrate }: Props) {
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const builds = useAppStore((s) => s.builds)
  const activeBlueprintId = useAppStore((s) => s.activeBlueprintId)
  const dayClaims = useAppStore((s) => s.dayClaims)
  const checkInDay = useAppStore((s) => s.checkInDay)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [toast, setToast] = useState<{ text: string; accent?: boolean } | null>(null)

  const day = todayKey()
  const now = new Date()
  const active = habits.filter((h) => !h.archivedAt)
  const blueprint = getBlueprint(activeBlueprintId)
  const placedCount = builds.filter((b) => b.blueprintId === activeBlueprintId).length

  const doneCount = useMemo(
    () => active.filter((h) => checkIns.some((c) => c.habitId === h.id && c.date === day)).length,
    [active, checkIns, day],
  )
  const claimed = dayClaims.includes(day)
  const allDone = active.length > 0 && doneCount === active.length

  const grouped = useMemo(() => {
    const g = new Map<HabitPeriod, Habit[]>()
    for (const p of PERIOD_ORDER) g.set(p, [])
    for (const h of active) g.get(h.period ?? 'any')!.push(h)
    return g
  }, [active])

  function showToast(text: string, accent = false) {
    setToast({ text, accent })
    setTimeout(() => setToast(null), 2400)
  }

  function handleDayCheck() {
    const res = checkInDay()
    if (res.placed) {
      showToast(
        `+1 积木 · ${blueprint.name} ${placedCount + 1}/${blueprint.blocks.length}${res.bonus ? ' · 连击奖励' : ''}`,
        res.bonus,
      )
      // 稍等片刻展示「已打卡」，再跳建造页看拼接动画
      setTimeout(() => onCelebrate?.(), 650)
    }
  }

  return (
    <div style={{ padding: '24px 24px 120px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>
          {now.getMonth() + 1} 月 {now.getDate()} 日
          <span style={{ color: 'var(--ink-2)', fontSize: 14, marginLeft: 10, fontWeight: 400 }}>
            周{WEEKDAYS[now.getDay()]}
          </span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              color: 'var(--ink-2)',
              fontSize: 13,
              border: '1px solid var(--line)',
              borderRadius: 999,
              padding: '4px 12px',
            }}
          >
            {doneCount} / {active.length}
          </span>
          <button className="icon-btn" title="新建习惯" onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <IconPlus size={20} />
          </button>
        </div>
      </div>

      <div style={{ height: 20 }} />

      {active.length === 0 ? (
        <div
          className="card"
          style={{ color: 'var(--ink-2)', padding: '52px 24px', textAlign: 'center', fontSize: 14, lineHeight: 2 }}
        >
          还没有习惯。点右上角 + 创建第一个，
          <br />
          完成一天全部任务后即可打卡，为「{blueprint.name}」掉落一块积木。
        </div>
      ) : (
        PERIOD_ORDER.map((p) => {
          const list = grouped.get(p)!
          if (list.length === 0) return null
          return (
            <section key={p} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--ink-2)',
                  letterSpacing: '0.14em',
                  margin: '4px 2px 10px',
                }}
              >
                {PERIOD_TITLE[p]}
              </div>
              <div className="habit-grid">
                {list.map((h) => (
                  <HabitRow
                    key={h.id}
                    habit={h}
                    day={day}
                    done={checkIns.some((c) => c.habitId === h.id && c.date === day)}
                    streak={currentStreak(h, checkIns, now)}
                    onEdit={() => {
                      setEditing(h)
                      setDialogOpen(true)
                    }}
                  />
                ))}
              </div>
            </section>
          )
        })
      )}

      <button
        className={`day-check${claimed ? ' done' : allDone ? ' ready' : ''}`}
        disabled={claimed || !allDone}
        onClick={handleDayCheck}
        title={
          claimed
            ? '今日已打卡'
            : allDone
              ? '打卡！掉落一块积木'
              : `完成全部 ${active.length} 个任务后解锁（${doneCount}/${active.length}）`
        }
      >
        {claimed ? <IconCheck size={20} /> : <IconDayCheck size={22} />}
        {claimed ? '已打卡' : allDone ? '打卡' : `还差 ${active.length - doneCount} 个任务`}
      </button>

      {dialogOpen && (
        <HabitDialog
          habit={editing ?? undefined}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
        />
      )}
      {toast && (
        <div className="toast">
          {toast.accent ? <span className="accent">◆ </span> : null}
          {toast.text}
        </div>
      )}
    </div>
  )
}
