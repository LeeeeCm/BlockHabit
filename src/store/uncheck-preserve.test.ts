import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './appStore'
import { dateKey } from '../logic/dates'

/**
 * A5b / A9 回归：
 * - 存档里存在「无法由事实推导的积木」时（旧版本 / 外部导入），撤销打卡不得把它们抹掉；
 * - 删除习惯要清理 reminderLog（否则随习惯删除无限增长）。
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
    deletedDayClaims: [],
    reminderLog: {},
    repairBricks: 0
  })
}

describe('uncheckIn 保守路径（不丢无法推导的块）', () => {
  beforeEach(reset)

  it('builds 含历史遗留块时只移除对应块并压实，不重建整层', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('读书', { type: 'daily' })
    const day = dateKey(new Date())

    useAppStore.setState({
      checkIns: [
        {
          id: 'c1',
          habitId: habit.id,
          date: day,
          at: new Date().toISOString(),
          placedBlockId: 'b1',
          blueprintId: 'plant'
        }
      ],
      // legacy-1 无法由任何打卡/全勤事实推导（模拟旧档）
      builds: [
        {
          id: 'b1',
          blueprintId: 'plant',
          index: 0,
          placedAt: '2026-01-01T00:00:00.000Z',
          fromHabitId: habit.id,
          bonus: false
        },
        {
          id: 'legacy-1',
          blueprintId: 'plant',
          index: 1,
          placedAt: '2025-12-01T00:00:00.000Z',
          fromHabitId: habit.id,
          bonus: false
        }
      ]
    })

    const res = useAppStore.getState().uncheckIn(habit.id, day)
    expect(res.ok).toBe(true)
    expect(res.removedBlock).toBe(true)

    const after = useAppStore.getState()
    // 遗留块被保留（全量重建会把它抹掉），index 压实到 0
    expect(after.builds.map((b) => b.id)).toEqual(['legacy-1'])
    expect(after.builds[0].index).toBe(0)
    // 打卡已墓碑化
    expect(after.checkIns[0].deletedAt).toBeTruthy()
  })

  it('投影与事实一致时仍走重建路径（index 连续压实）', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('跑步', { type: 'daily' })
    const day = dateKey(new Date())

    useAppStore.setState({
      checkIns: [
        {
          id: 'c1',
          habitId: habit.id,
          date: day,
          at: '2026-01-01T00:00:00.000Z',
          placedBlockId: 'b1',
          blueprintId: 'plant'
        },
        { id: 'c2', habitId: habit.id, date: day, at: '2026-01-02T00:00:00.000Z' }
      ],
      builds: [
        {
          id: 'b1',
          blueprintId: 'plant',
          index: 0,
          placedAt: '2026-01-01T00:00:00.000Z',
          fromHabitId: habit.id,
          bonus: false
        }
      ]
    })

    useAppStore.getState().uncheckIn(habit.id, day)
    expect(useAppStore.getState().builds).toHaveLength(0)
  })
})

describe('deleteHabit 清理（A9）', () => {
  beforeEach(reset)

  it('删除习惯同时清除其 reminderLog 记录', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('喝水', { type: 'daily' })
    useAppStore.setState({ reminderLog: { [habit.id]: { date: '2026-01-01', action: 'skipped' } } })

    useAppStore.getState().deleteHabit(habit.id)

    const after = useAppStore.getState()
    expect(after.habits).toHaveLength(0)
    expect(after.reminderLog?.[habit.id]).toBeUndefined()
  })
})
