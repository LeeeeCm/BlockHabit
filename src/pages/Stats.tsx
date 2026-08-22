import { useMemo } from 'react'
import { useAppStore } from '../store/appStore'
import { bestStreak, currentStreak } from '../logic/streak'
import { Heatmap } from '../components/Heatmap'

export default function Stats() {
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const now = new Date()

  const active = habits.filter((h) => !h.archivedAt)
  const rows = useMemo(
    () =>
      active.map((h) => ({
        habit: h,
        current: currentStreak(h, checkIns, now),
        best: bestStreak(h, checkIns),
        total: checkIns.filter((c) => c.habitId === h.id).length,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, checkIns],
  )

  return (
    <div style={{ padding: '28px 24px', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, margin: '0 0 18px' }}>统计</h1>

      {rows.length === 0 ? (
        <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>还没有习惯，先去「今日」创建。</div>
      ) : (
        rows.map(({ habit, current, best, total }) => (
          <div
            key={habit.id}
            style={{
              border: '1px solid var(--line)',
              padding: '14px 16px',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15 }}>{habit.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                {habit.frequency.type === 'daily' ? '每天' : `每周 ${habit.frequency.times} 次`}
              </div>
            </div>
            <Stat label="当前连击" value={current} accent={current > 0 && current % 7 === 0} />
            <Stat label="最长连击" value={best} />
            <Stat label="总打卡" value={total} />
          </div>
        ))
      )}

      <h2 style={{ fontSize: 15, margin: '26px 0 12px', color: 'var(--ink-2)' }}>近 13 周</h2>
      <Heatmap habits={habits} checkIns={checkIns} />
    </div>
  )
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 56 }}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: accent ? 'var(--accent)' : 'var(--ink)',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>{label}</div>
    </div>
  )
}
