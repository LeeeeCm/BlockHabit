import { useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { todayKey } from '../logic/dates'
import { currentStreak } from '../logic/streak'
import { getBlueprint } from '../logic/blueprints'
import { HabitRow } from '../components/HabitRow'
import { HabitDialog } from '../components/HabitDialog'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export default function Today() {
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const builds = useAppStore((s) => s.builds)
  const activeBlueprintId = useAppStore((s) => s.activeBlueprintId)
  const [dialogOpen, setDialogOpen] = useState(false)
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

  function showToast(text: string, accent = false) {
    setToast({ text, accent })
    setTimeout(() => setToast(null), 2400)
  }

  return (
    <div style={{ padding: '28px 24px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>
          {now.getMonth() + 1} 月 {now.getDate()} 日
          <span style={{ color: 'var(--ink-2)', fontSize: 14, marginLeft: 10 }}>周{WEEKDAYS[now.getDay()]}</span>
        </h1>
        <span style={{ color: 'var(--ink-2)', fontSize: 13 }}>
          {doneCount} / {active.length}
        </span>
      </div>

      <div style={{ height: 2, background: 'var(--line)', margin: '18px 0' }} />

      {active.length === 0 ? (
        <div style={{ color: 'var(--ink-2)', padding: '48px 0', textAlign: 'center', fontSize: 14 }}>
          还没有习惯。点右下角 + 创建第一个，
          <br />
          每次打卡都会为你的「{blueprint.name}」添上一块积木。
        </div>
      ) : (
        active.map((h) => (
          <HabitRow
            key={h.id}
            habit={h}
            done={checkIns.some((c) => c.habitId === h.id && c.date === day)}
            streak={currentStreak(h, checkIns, now)}
            onCheck={(res) => {
              if (res.placed) {
                showToast(
                  `+1 积木 · ${blueprint.name} ${placedCount + 1}/${blueprint.blocks.length}${res.bonus ? ' · 连击奖励' : ''}`,
                  res.bonus,
                )
              }
            }}
          />
        ))
      )}

      <button className="fab" title="新建习惯" onClick={() => setDialogOpen(true)}>
        +
      </button>

      {dialogOpen && <HabitDialog onClose={() => setDialogOpen(false)} />}
      {toast && (
        <div className="toast">
          {toast.accent ? <span className="accent">◆ </span> : null}
          {toast.text}
        </div>
      )}
    </div>
  )
}
