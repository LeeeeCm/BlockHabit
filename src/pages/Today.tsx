import { useMemo, useState } from 'react'
import type { Habit, HabitPeriod } from '../types'
import { useAppStore } from '../store/appStore'
import { todayKey } from '../logic/dates'
import { currentStreak } from '../logic/streak'
import { getBlueprint } from '../logic/blueprints'
import { HabitRow } from '../components/HabitRow'
import { HabitDialog } from '../components/HabitDialog'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const PERIOD_ORDER: HabitPeriod[] = ['morning', 'afternoon', 'evening', 'any']
const PERIOD_TITLE: Record<HabitPeriod, string> = {
  morning: '早晨',
  afternoon: '午后',
  evening: '夜晚',
  any: '任意时段',
}

export default function Today() {
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const builds = useAppStore((s) => s.builds)
  const activeBlueprintId = useAppStore((s) => s.activeBlueprintId)
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

  return (
    <div style={{ padding: '24px 24px 40px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>
          {now.getMonth() + 1} 月 {now.getDate()} 日
          <span style={{ color: 'var(--ink-2)', fontSize: 14, marginLeft: 10, fontWeight: 400 }}>
            周{WEEKDAYS[now.getDay()]}
          </span>
        </h1>
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
      </div>

      <div style={{ height: 20 }} />

      {active.length === 0 ? (
        <div
          className="card"
          style={{ color: 'var(--ink-2)', padding: '52px 24px', textAlign: 'center', fontSize: 14, lineHeight: 2 }}
        >
          还没有习惯。点右下角 + 创建第一个，
          <br />
          每次打卡都会为你的「{blueprint.name}」添上一块积木。
        </div>
      ) : (
        PERIOD_ORDER.map((p) => {
          const list = grouped.get(p)!
          if (list.length === 0) return null
          return (
            <section key={p} style={{ marginBottom: 18 }}>
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
              {list.map((h) => (
                <HabitRow
                  key={h.id}
                  habit={h}
                  day={day}
                  done={checkIns.some((c) => c.habitId === h.id && c.date === day)}
                  streak={currentStreak(h, checkIns, now)}
                  onCheck={(res) => {
                    if (res.placed) {
                      showToast(
                        `+1 积木 · ${blueprint.name} ${placedCount + 1}/${blueprint.blocks.length}${
                          res.bonus ? ' · 连击奖励' : ''
                        }`,
                        res.bonus,
                      )
                    }
                  }}
                  onEdit={() => {
                    setEditing(h)
                    setDialogOpen(true)
                  }}
                />
              ))}
            </section>
          )
        })
      )}

      <button
        className="fab"
        title="新建习惯"
        onClick={() => {
          setEditing(null)
          setDialogOpen(true)
        }}
      >
        +
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
