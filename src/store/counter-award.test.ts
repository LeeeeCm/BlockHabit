import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './appStore'

/**
 * B2 回归：counter 习惯的刷块漏洞。
 * 旧实现只要"跨阈值事件"就发块 → 「达标 → 减一档 → 加回来」可无限产出积木。
 */
describe('counter habit block award (anti-exploit)', () => {
  beforeEach(() => {
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
    })
  })

  it('达标前不掉块，达标时掉一块，之后递减再递增不再掉块', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('喝水', { type: 'daily' }, { kind: 'counter', targetValue: 3, step: 1 })
    const id = habit.id

    useAppStore.getState().checkIn(id) // 1 / 3
    useAppStore.getState().checkIn(id) // 2 / 3
    expect(useAppStore.getState().builds).toHaveLength(0)

    useAppStore.getState().checkIn(id) // 3 / 3 达标 → 掉一块
    expect(useAppStore.getState().builds).toHaveLength(1)

    // 减一档（负增量只改数值，不参与跨阈值）
    useAppStore.getState().checkIn(id, undefined, undefined, -1)
    // 加回来：当日已掉过块，不得再掉第二块
    useAppStore.getState().checkIn(id)
    expect(useAppStore.getState().builds).toHaveLength(1)
  })

  it('首次跨阈值后即使继续加量也不再掉块', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('俯卧撑', { type: 'daily' }, { kind: 'counter', targetValue: 2, step: 1 })
    useAppStore.getState().checkIn(habit.id)
    useAppStore.getState().checkIn(habit.id)
    expect(useAppStore.getState().builds).toHaveLength(1)
    useAppStore.getState().checkIn(habit.id)
    expect(useAppStore.getState().builds).toHaveLength(1)
  })
})
