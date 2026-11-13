import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './appStore'
import { addDays, dateKey } from '../logic/dates'
import { rebuildBuilds } from '../logic/builds'
import type { CheckIn } from '../types'

/**
 * B1 回归：连击里程碑奖励块（README 承诺「连击每满 7 天，下一块为点缀色 bonus 积木」）。
 * 旧实现：数据层不给块打标、渲染层六个入口都不传 bonus → iso.ts 的琥珀描边是死代码。
 */
function reset() {
  useAppStore.setState({
    schemaVersion: 2,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' },
    dayClaims: [],
    deletedDayClaims: []
  })
}

/** 造 n 天连续打卡记录（不含今天） */
function seedStreak(habitId: string, n: number): CheckIn[] {
  const out: CheckIn[] = []
  for (let i = n; i >= 1; i--) {
    const d = dateKey(addDays(new Date(), -i))
    out.push({ id: `seed-${i}`, habitId, date: d, at: `${d}T08:00:00.000Z` })
  }
  return out
}

describe('连击里程碑奖励块（B1）', () => {
  beforeEach(reset)

  it('连击第 7 天掉落 bonus 积木，并写入 PlacedBlock.bonus 与 CheckIn.bonus', () => {
    const habit = useAppStore.getState().addHabit('读书', { type: 'daily' })
    useAppStore.setState({ checkIns: seedStreak(habit.id, 6) })

    const res = useAppStore.getState().checkIn(habit.id)
    expect(res.placed).toBeDefined()
    expect(res.bonus).toBe(true)

    const after = useAppStore.getState()
    expect(after.builds).toHaveLength(1)
    expect(after.builds[0].bonus).toBe(true)
    const todayEntry = after.checkIns[after.checkIns.length - 1]
    expect(todayEntry.bonus).toBe(true)
  })

  it('非里程碑日（第 3 天）掉落普通积木', () => {
    const habit = useAppStore.getState().addHabit('跑步', { type: 'daily' })
    useAppStore.setState({ checkIns: seedStreak(habit.id, 2) })

    const res = useAppStore.getState().checkIn(habit.id)
    expect(res.bonus).toBe(false)
    expect(useAppStore.getState().builds[0].bonus).toBe(false)
    expect(useAppStore.getState().checkIns.slice(-1)[0].bonus).toBeUndefined()
  })

  it('第 14 天同样触发', () => {
    const habit = useAppStore.getState().addHabit('冥想', { type: 'daily' })
    useAppStore.setState({ checkIns: seedStreak(habit.id, 13) })
    expect(useAppStore.getState().checkIn(habit.id).bonus).toBe(true)
  })

  it('投影重建保留 bonus（同步/导入后不丢标记）', () => {
    const live: CheckIn[] = [
      {
        id: 'c1',
        habitId: 'h1',
        date: '2026-01-01',
        at: '2026-01-01T08:00:00.000Z',
        placedBlockId: 'b1',
        blueprintId: 'plant',
        bonus: true
      },
      {
        id: 'c2',
        habitId: 'h1',
        date: '2026-01-02',
        at: '2026-01-02T08:00:00.000Z',
        placedBlockId: 'b2',
        blueprintId: 'plant'
      }
    ]
    const builds = rebuildBuilds(live, [])
    expect(builds.find((b) => b.id === 'b1')?.bonus).toBe(true)
    expect(builds.find((b) => b.id === 'b2')?.bonus).toBe(false)
  })
})
