import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './appStore'
import { getBlueprint } from '../logic/blueprints'
import { dateKey } from '../logic/dates'

describe('appStore checkIn & uncheckIn block economy', () => {
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

  it('checkIn immediately awards a block to activeBlueprint', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('喝水', { type: 'daily' }, { kind: 'instant' })

    const res = store.checkIn(habit.id)
    expect(res.placed).toBeDefined()
    expect(res.complete).toBe(false)

    const updated = useAppStore.getState()
    expect(updated.checkIns).toHaveLength(1)
    expect(updated.builds).toHaveLength(1)
    expect(updated.builds[0].blueprintId).toBe('plant')
    expect(updated.builds[0].fromHabitId).toBe(habit.id)
  })

  it('checkIn records actualMinutes when supplied from focus timer', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('深度编程', { type: 'daily' }, { kind: 'focus', targetMinutes: 30 })

    store.checkIn(habit.id, 18)
    const updated = useAppStore.getState()
    expect(updated.checkIns[0].actualMinutes).toBe(18)
  })

  it('updateSettings persists volume (0-100) into exportData', () => {
    const store = useAppStore.getState()
    store.updateSettings({ volume: 40 })
    expect(JSON.parse(useAppStore.getState().exportData()).settings.volume).toBe(40)
    store.updateSettings({ volume: 100 })
    expect(JSON.parse(useAppStore.getState().exportData()).settings.volume).toBe(100)
  })

  it('updateSettings persists soundMuted into exportData', () => {
    const store = useAppStore.getState()
    store.updateSettings({ soundMuted: true })
    expect(JSON.parse(useAppStore.getState().exportData()).settings.soundMuted).toBe(true)
    store.updateSettings({ soundMuted: false })
    expect(JSON.parse(useAppStore.getState().exportData()).settings.soundMuted).toBe(false)
  })

  it('after undo the habit can check in again (tombstone invisible to canCheckIn)', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('跑步', { type: 'daily' })

    store.checkIn(habit.id)
    store.uncheckIn(habit.id)

    // 撤销后当天可重新打卡：墓碑不算"已打卡"
    const res = store.checkIn(habit.id)
    expect(res.reason).toBeUndefined()
    expect(res.placed).toBeDefined()
  })

  it('undo closes the day-claim re-exploit (tombstone not counted as met)', () => {
    const store = useAppStore.getState()
    const a = store.addHabit('习惯A', { type: 'daily' })
    const b = store.addHabit('习惯B', { type: 'daily' })

    store.checkIn(a.id)
    store.checkIn(b.id)
    expect(store.checkInDay().placed).toBeDefined()

    // 撤销 A → 全勤回收
    store.uncheckIn(a.id)
    expect(useAppStore.getState().dayClaims).toHaveLength(0)

    // B2 防御：直接再次领取必须判定 incomplete，不得刷块
    const res = store.checkInDay()
    expect(res.reason).toBe('incomplete')
    expect(useAppStore.getState().dayClaims).toHaveLength(0)
  })

  it('uncheckIn tombstones the checkin and rolls back the placed block', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('晨起做拉伸', { type: 'daily' })

    store.checkIn(habit.id)
    expect(useAppStore.getState().builds).toHaveLength(1)

    const undoRes = store.uncheckIn(habit.id)
    expect(undoRes.ok).toBe(true)
    expect(undoRes.removedBlock).toBe(true)

    const updated = useAppStore.getState()
    // v2 语义：打卡记录墓碑化（保留用于同步删除语义），积木投影回收
    expect(updated.checkIns).toHaveLength(1)
    expect(updated.checkIns[0].deletedAt).toBeDefined()
    expect(updated.builds).toHaveLength(0)
  })

  it('checkInDay awards daily all-clear bonus and claims day', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('读书', { type: 'daily' })

    // 先完成习惯打卡 (获得 1 块)
    store.checkIn(habit.id)
    expect(useAppStore.getState().builds).toHaveLength(1)

    // 全勤打卡 (额外获得 1 块带 bonus 标记的里程碑块)
    const claimRes = store.checkInDay()
    expect(claimRes.placed).toBeDefined()
    // 返回值 bonus 是「连击满 7 天」的里程碑标记，单日全勤为 false
    expect(claimRes.bonus).toBe(false)

    const updated = useAppStore.getState()
    expect(updated.dayClaims).toHaveLength(1)
    expect(updated.builds).toHaveLength(2)
    expect(updated.builds[1].fromHabitId).toBe('__day__')
    expect(updated.builds[1].bonus).toBe(true)
  })

  it('checkInDay returns bonus=true exactly on the 7th consecutive day', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('读书', { type: 'daily' })
    store.checkIn(habit.id)

    // 预置此前连续 6 天的全勤领取记录
    const dayMs = 86_400_000
    const prevDays = Array.from({ length: 6 }, (_, i) => dateKey(new Date(Date.now() - (i + 1) * dayMs)))
    useAppStore.setState({
      dayClaims: prevDays.map((d) => ({ date: d, claimedAt: `${d}T12:00:00.000Z`, blockId: '', blueprintId: 'plant' })),
    })

    const claimRes = store.checkInDay()
    expect(claimRes.placed).toBeDefined()
    expect(claimRes.bonus).toBe(true)

    const claimRes2 = store.checkInDay()
    expect(claimRes2.reason).toBe('already')
  })

  it('completes blueprint when total blocks are reached', () => {
    const store = useAppStore.getState()
    const bp = getBlueprint('plant')
    const habit = store.addHabit('日常打卡', { type: 'daily' })

    // 手动填充至仅剩 1 块
    const dummyBuilds = bp.blocks.slice(0, bp.blocks.length - 1).map((_, i) => ({
      id: `dummy-${i}`,
      blueprintId: 'plant',
      index: i,
      placedAt: new Date().toISOString(),
      fromHabitId: 'seed',
      bonus: false,
    }))
    useAppStore.setState({ builds: dummyBuilds })

    const res = store.checkIn(habit.id)
    expect(res.complete).toBe(true)

    const updated = useAppStore.getState()
    expect(updated.completedBlueprintIds).toContain('plant')
  })

  it('uncheckIn rolls back dayClaims AND bonus milestone block to prevent block cloning', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('喝水', { type: 'daily' })

    store.checkIn(habit.id)
    store.checkInDay()
    expect(useAppStore.getState().dayClaims).toHaveLength(1)
    expect(useAppStore.getState().builds).toHaveLength(2)

    // 撤销打卡：全勤不再成立，应该同时收回打卡块和全勤奖励块
    store.uncheckIn(habit.id)
    const state = useAppStore.getState()
    expect(state.checkIns).toHaveLength(1) // 墓碑保留
    expect(state.checkIns[0].deletedAt).toBeDefined()
    expect(state.dayClaims).toHaveLength(0)
    expect(state.deletedDayClaims).toHaveLength(1) // 领取记录墓碑化，防反复刷块
    expect(state.builds).toHaveLength(0)
  })

  it('does not return complete: true when blueprint was already completed', () => {
    const store = useAppStore.getState()
    const bp = getBlueprint('plant')
    const habit1 = store.addHabit('习惯1', { type: 'daily' })
    // 填充至完成
    const fullBuilds = bp.blocks.map((_, i) => ({
      id: `block-${i}`,
      blueprintId: 'plant',
      index: i,
      placedAt: new Date().toISOString(),
      fromHabitId: 'seed',
      bonus: false,
    }))
    useAppStore.setState({
      builds: fullBuilds,
      completedBlueprintIds: ['plant'],
    })

    // 后续在已建成的蓝图上打卡，不应再报告 complete: true
    const res = store.checkIn(habit1.id)
    expect(res.complete).toBe(false)
  })

  it('correctly reverts completed status when unchecking block from completed blueprint', () => {
    const store = useAppStore.getState()
    const bp = getBlueprint('plant')
    const habit = store.addHabit('习惯A', { type: 'daily' })

    // 填充至差 1 块
    const almostFull = bp.blocks.slice(0, bp.blocks.length - 1).map((_, i) => ({
      id: `b-${i}`,
      blueprintId: 'plant',
      index: i,
      placedAt: new Date().toISOString(),
      fromHabitId: 'seed',
      bonus: false,
    }))
    useAppStore.setState({ builds: almostFull })

    const res = store.checkIn(habit.id)
    expect(res.complete).toBe(true)
    expect(useAppStore.getState().completedBlueprintIds).toContain('plant')

    // 撤销该打卡：蓝图退回未完成
    store.uncheckIn(habit.id)
    expect(useAppStore.getState().completedBlueprintIds).not.toContain('plant')
  })

  it('awards 1 repair brick on blueprint completion (max 2)', () => {
    const store = useAppStore.getState()
    const bp = getBlueprint('plant')
    const habit = store.addHabit('落成测试', { type: 'daily' })

    const almostFull = bp.blocks.slice(0, bp.blocks.length - 1).map((_, i) => ({
      id: `almost-${i}`,
      blueprintId: 'plant',
      index: i,
      placedAt: new Date().toISOString(),
      fromHabitId: 'seed',
      bonus: false,
    }))
    useAppStore.setState({ builds: almostFull, repairBricks: 0 })

    store.checkIn(habit.id)
    expect(useAppStore.getState().repairBricks).toBe(1)
  })

  it('useRepairBrick consumes a brick and saves retroactive checkin', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('健身', { type: 'daily' })
    useAppStore.setState({ repairBricks: 1 })

    const res = store.useRepairBrick(habit.id, '2026-08-20')
    expect(res.ok).toBe(true)
    expect(useAppStore.getState().repairBricks).toBe(0)
    expect(useAppStore.getState().checkIns).toHaveLength(1)
    expect(useAppStore.getState().checkIns[0].date).toBe('2026-08-20')
  })

  it('useRepairBrick rejects when inventory is empty', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('健身', { type: 'daily' })
    useAppStore.setState({ repairBricks: 0 })

    const res = store.useRepairBrick(habit.id, '2026-08-20')
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('no-bricks')
  })

  it('counter habit accumulates value and awards block when target is met', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('喝水 2000ml', { type: 'daily' }, {
      kind: 'counter',
      targetValue: 2000,
      unit: 'ml',
      step: 500,
    })

    // Step 1: 500ml -> no block yet
    const res1 = store.checkIn(habit.id, undefined, undefined, 500)
    expect(res1.placed).toBeUndefined()
    expect(useAppStore.getState().builds).toHaveLength(0)

    // Step 2: +500ml = 1000ml -> no block yet
    const res2 = store.checkIn(habit.id, undefined, undefined, 500)
    expect(res2.placed).toBeUndefined()
    expect(useAppStore.getState().builds).toHaveLength(0)

    // Step 3: +1000ml = 2000ml -> target reached! awards 1 block
    const res3 = store.checkIn(habit.id, undefined, undefined, 1000)
    expect(res3.placed).toBeDefined()
    expect(useAppStore.getState().builds).toHaveLength(1)

    // Step 4: extra step does not duplicate block
    const res4 = store.checkIn(habit.id, undefined, undefined, 500)
    expect(res4.placed).toBeUndefined()
    expect(useAppStore.getState().builds).toHaveLength(1)

    // uncheckIn rolls back checkIns and block
    const undo = store.uncheckIn(habit.id)
    expect(undo.ok).toBe(true)
    expect(undo.removedBlock).toBe(true)
    expect(useAppStore.getState().builds).toHaveLength(0)
  })

  it('togglePinHabit pins and unpins habit', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('重要任务', { type: 'daily' })
    expect(habit.pinned).toBeUndefined()

    store.togglePinHabit(habit.id)
    expect(useAppStore.getState().habits[0].pinned).toBe(true)

    store.togglePinHabit(habit.id)
    expect(useAppStore.getState().habits[0].pinned).toBe(false)
  })

  it('recordCheckInNote updates reflection note on checkin', () => {
    const store = useAppStore.getState()
    const habit = store.addHabit('阅读', { type: 'daily' })
    store.checkIn(habit.id, undefined, '第一天完成，感觉充实')

    const checkIn = useAppStore.getState().checkIns[0]
    expect(checkIn.note).toBe('第一天完成，感觉充实')
    store.recordCheckInNote(checkIn.id, '修改后的感悟笔记', 'energetic', true)
    const updated = useAppStore.getState().checkIns[0]
    expect(updated.note).toBe('修改后的感悟笔记')
    expect(updated.mood).toBe('energetic')
    expect(updated.starred).toBe(true)

    store.toggleCheckInStar(checkIn.id)
    expect(useAppStore.getState().checkIns[0].starred).toBe(false)
  })

  it('sets and retrieves foundation note', () => {
    const store = useAppStore.getState()
    store.setFoundationNote('castle', '历时百日，终成城堡')
    expect(useAppStore.getState().foundationNotes?.['castle']).toBe('历时百日，终成城堡')
  })

  it('supports oat and fog themes in appStore (DOM sync lives in App layer)', () => {
    const store = useAppStore.getState()
    store.setTheme('oat')
    expect(useAppStore.getState().settings.theme).toBe('oat')

    store.setTheme('fog')
    expect(useAppStore.getState().settings.theme).toBe('fog')
  })
})
