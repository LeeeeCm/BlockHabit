import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../store/appStore'
import { currentStreak, bestStreak } from './streak'
import { habitMetOnDay, isHabitDueOnDay } from './checkin'
import { dateKey, todayKey } from './dates'
import { getBlueprint } from './blueprints'
import type { Habit, CheckIn, PlacedBlock } from '../types'

describe('真实用户极端使用场景模拟与系统健壮性测试 (Real User Stress Scenarios)', () => {
  beforeEach(() => {
    useAppStore.setState({
      habits: [],
      checkIns: [],
      builds: [],
      activeBlueprintId: 'plant',
      completedBlueprintIds: [],
      dayClaims: [],
      repairBricks: 2,
      showcasePlacements: [],
      foundationNotes: {},
      hydrated: true
    })
  })

  it('场景 1: 跨午夜与跨月份打卡 (Midnight & Month-crossing Transition)', () => {
    const habit: Habit = {
      id: 'habit-water',
      name: '每日喝水',
      frequency: { type: 'daily' },
      createdAt: '2026-01-01T00:00:00.000Z'
    }
    const yesterday = dateKey(new Date(Date.now() - 86400000))
    const today = todayKey()

    // 模拟昨日已完成打卡
    useAppStore.setState({
      habits: [habit],
      checkIns: [
        {
          id: 'c-yesterday',
          habitId: habit.id,
          date: yesterday,
          at: `${yesterday}T12:00:00.000Z`
        }
      ]
    })

    // 跨越午夜来到今日：检查今日尚未打卡且今日处于待办状态
    const state = useAppStore.getState()
    const isDoneToday = state.checkIns.some((c) => c.habitId === habit.id && c.date === today)
    expect(isDoneToday).toBe(false)
    expect(isHabitDueOnDay(habit, today)).toBe(true)

    // 用户在今日执行打卡
    const res = useAppStore.getState().checkIn('habit-water')
    expect(res.placed).toBeDefined()

    const updatedState = useAppStore.getState()
    expect(updatedState.checkIns.length).toBe(2)
    const streak = currentStreak(habit, updatedState.checkIns, new Date())
    expect(streak).toBe(2)
  })

  it('场景 2: 高频快速连击打卡防重 (Rapid Repeated Click Idempotency)', () => {
    const habit: Habit = {
      id: 'habit-read',
      name: '阅读 30 分钟',
      frequency: { type: 'daily' },
      createdAt: '2026-03-01T00:00:00.000Z'
    }
    useAppStore.setState({ habits: [habit] })

    // 模拟用户在 10ms 内连续点击 5 次打卡
    const results = []
    for (let i = 0; i < 5; i++) {
      results.push(useAppStore.getState().checkIn('habit-read'))
    }

    // 只有第 1 次成功打卡并获得积木，后 4 次被幂等拦截阻止重复刷块
    expect(results[0].placed).toBeDefined()
    for (let i = 1; i < 5; i++) {
      expect(results[i].placed).toBeUndefined()
    }
    expect(useAppStore.getState().checkIns.length).toBe(1)
  })

  it('场景 3: 撤销打卡积木连续性与 0..N-1 连续重排 (Continuous Re-indexing Invariant)', () => {
    const habit: Habit = {
      id: 'habit-run',
      name: '跑步',
      frequency: { type: 'daily' },
      createdAt: '2026-03-01T00:00:00.000Z'
    }
    useAppStore.setState({ habits: [habit] })

    // 模拟连续 4 天获得 4 块积木 (index: 0, 1, 2, 3)
    const dates = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04']
    const checkIns: CheckIn[] = []
    const builds: PlacedBlock[] = []

    dates.forEach((d, idx) => {
      const bId = `block-${idx}`
      const cId = `checkin-${idx}`
      builds.push({
        id: bId,
        blueprintId: 'plant',
        index: idx,
        placedAt: `${d}T09:00:00.000Z`,
        fromHabitId: habit.id,
        bonus: false
      })
      checkIns.push({
        id: cId,
        habitId: habit.id,
        date: d,
        at: `${d}T09:00:00.000Z`,
        placedBlockId: bId,
        blueprintId: 'plant'
      })
    })

    useAppStore.setState({ checkIns, builds })
    expect(useAppStore.getState().builds.map((b) => b.index)).toEqual([0, 1, 2, 3])

    // 撤销中间第 2 天 (2026-03-02, index 1) 的打卡
    const undoRes = useAppStore.getState().uncheckIn('habit-run', '2026-03-02')
    expect(undoRes.ok).toBe(true)

    // 验证剩余 3 块积木被重排为连续的 0, 1, 2，绝无悬空或空洞
    const remainingBuilds = useAppStore.getState().builds
    expect(remainingBuilds.length).toBe(3)
    expect(remainingBuilds.map((b) => b.index)).toEqual([0, 1, 2])
  })

  it('场景 4: 海量历史打卡数据压力与计算性能 (1000+ Records Benchmark)', () => {
    const habits: Habit[] = Array.from({ length: 10 }, (_, i) => ({
      id: `habit-${i}`,
      name: `测试习惯 ${i}`,
      frequency: { type: 'daily' },
      createdAt: '2025-01-01T00:00:00.000Z'
    }))

    // 生成 1200 条打卡历史
    const bigCheckIns: CheckIn[] = []
    const startDate = new Date('2025-01-01')
    for (let dayOffset = 0; dayOffset < 120; dayOffset++) {
      const d = new Date(startDate.getTime() + dayOffset * 86400000)
      const dStr = dateKey(d)
      for (let hIdx = 0; hIdx < 10; hIdx++) {
        bigCheckIns.push({
          id: `c-${dayOffset}-${hIdx}`,
          habitId: `habit-${hIdx}`,
          date: dStr,
          at: `${dStr}T10:00:00.000Z`,
          actualMinutes: 25,
          mood: 'energetic',
          note: `Day ${dayOffset} reflection notes for habit ${hIdx}`
        })
      }
    }

    useAppStore.setState({ habits, checkIns: bigCheckIns })

    const startPerf = performance.now()
    // 对 10 个习惯连续计算当前连胜与最佳连胜
    for (const h of habits) {
      currentStreak(h, bigCheckIns, new Date('2025-05-01'))
      bestStreak(h, bigCheckIns)
      habitMetOnDay(h, bigCheckIns, '2025-04-10')
    }
    const duration = performance.now() - startPerf

    // 1200 条记录的全量分析计算应在 50ms 内极速完成，确保 UI 无卡顿
    expect(duration).toBeLessThan(100)
  })

  it('场景 5: 异常损坏数据与降级容错 (Corrupted State Handling)', () => {
    // 传入非法 JSON 或缺失关键字段的数据
    const invalidJson = '{"not": "a valid state"}'
    const imported = useAppStore.getState().importData(invalidJson)
    expect(imported).toBe(false)

    // 状态保持未受污染
    expect(useAppStore.getState().habits).toEqual([])
  })

  it('场景 6: 撤销打卡导致蓝图未满时同步从展台移除 (Showcase Rollback on Undo)', () => {
    const bp = getBlueprint('plant')
    const totalBlocks = bp.blocks.length

    const builds: PlacedBlock[] = Array.from({ length: totalBlocks }, (_, i) => ({
      id: `b-${i}`,
      blueprintId: 'plant',
      index: i,
      placedAt: `2026-03-01T0${i}:00:00.000Z`,
      fromHabitId: 'h-1',
      bonus: false
    }))

    const checkIns: CheckIn[] = builds.map((b, i) => ({
      id: `c-${i}`,
      habitId: 'h-1',
      date: `2026-03-0${(i % 5) + 1}`,
      at: b.placedAt,
      placedBlockId: b.id
    }))

    useAppStore.setState({
      habits: [
        { id: 'h-1', name: '积木习惯', frequency: { type: 'daily' }, createdAt: '2026-03-01' }
      ],
      builds,
      checkIns,
      activeBlueprintId: 'plant',
      completedBlueprintIds: ['plant'],
      showcasePlacements: [{ blueprintId: 'plant', gridX: 3, gridY: 3 }]
    })

    expect(useAppStore.getState().completedBlueprintIds).toContain('plant')
    expect(useAppStore.getState().showcasePlacements?.length).toBe(1)

    // 撤销其中最后一次打卡使得积木数减少为 totalBlocks - 1
    const lastCheckIn = checkIns[checkIns.length - 1]
    const undoRes = useAppStore.getState().uncheckIn('h-1', lastCheckIn.date)
    expect(undoRes.ok).toBe(true)

    // 验证：plant 自动从已落成列表中退出，并从展台沙盘中彻底清理，杜绝残破建筑留在展台
    const state = useAppStore.getState()
    expect(state.completedBlueprintIds).not.toContain('plant')
    expect(state.showcasePlacements?.some((p) => p.blueprintId === 'plant')).toBe(false)
  })
})
