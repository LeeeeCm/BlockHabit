import { describe, expect, it } from 'vitest'
import {
  REPAIR_MAX,
  REPAIR_MONTHLY_QUOTA,
  REPAIR_WINDOW_DAYS,
  daysBetweenKeys,
  isWithinRepairWindow,
  monthKeyOf,
  refreshMonthlyAllowance,
  repairBricksForStreak
} from './repairBricks'

/**
 * F8：修复积木宽口径。
 * 旧规则（落成才给 1 块 / 上限 2 / 窗口 7 天）让「断签兜底」几乎不可用。
 */
describe('repairBricks · 月度额度', () => {
  it('月份变化时把库存补足到 2 块', () => {
    const r = refreshMonthlyAllowance(0, '2026-10', new Date('2026-11-10T10:00:00'))
    expect(r.count).toBe(REPAIR_MONTHLY_QUOTA)
    expect(r.month).toBe('2026-11')
    expect(r.granted).toBe(2)
  })

  it('同一个月内重复结算不发放（幂等）', () => {
    const first = refreshMonthlyAllowance(0, '2026-10', new Date('2026-11-10T10:00:00'))
    const second = refreshMonthlyAllowance(
      first.count,
      first.month,
      new Date('2026-11-20T10:00:00')
    )
    expect(second.count).toBe(first.count)
    expect(second.granted).toBe(0)
  })

  it('已有的里程碑奖励不会被月初结算清掉', () => {
    const r = refreshMonthlyAllowance(3, '2026-10', new Date('2026-11-01T00:00:00'))
    expect(r.count).toBe(3) // max(3, 2) 而不是重置为 2
    expect(r.granted).toBe(0)
  })

  it('补足不会超过持有上限', () => {
    const r = refreshMonthlyAllowance(REPAIR_MAX, '2026-10', new Date('2026-11-01T00:00:00'))
    expect(r.count).toBe(REPAIR_MAX)
    expect(r.granted).toBe(0)
  })

  it('首次运行（无记录月份）按当月发放', () => {
    expect(refreshMonthlyAllowance(0, undefined, new Date('2026-11-10T10:00:00')).count).toBe(2)
  })

  it('monthKeyOf 产出本地月份键', () => {
    expect(monthKeyOf(new Date('2026-03-05T12:00:00'))).toBe('2026-03')
    expect(monthKeyOf(new Date('2026-12-31T23:59:00'))).toBe('2026-12')
  })
})

describe('repairBricks · 连击里程碑', () => {
  it('连击跨过 30 天奖励 1 块', () => {
    expect(repairBricksForStreak(0, 29, 30)).toBe(1)
  })

  it('未跨过整数倍不奖励', () => {
    expect(repairBricksForStreak(1, 30, 31)).toBe(1)
    expect(repairBricksForStreak(1, 5, 6)).toBe(1)
  })

  it('一次跨多个里程碑按倍数奖励', () => {
    expect(repairBricksForStreak(0, 0, 60)).toBe(2)
  })

  it('奖励后不超过持有上限', () => {
    expect(repairBricksForStreak(REPAIR_MAX, 29, 30)).toBe(REPAIR_MAX)
  })

  it('连击回退（撤销打卡）不扣块', () => {
    expect(repairBricksForStreak(2, 30, 10)).toBe(2)
  })
})

describe('repairBricks · 补签窗口', () => {
  it('窗口内允许（含 30 天边界）', () => {
    expect(isWithinRepairWindow('2026-11-01', '2026-11-10')).toBe(true)
    expect(isWithinRepairWindow('2026-10-11', '2026-11-10')).toBe(true) // 30 天
  })

  it('超出窗口拒绝', () => {
    expect(isWithinRepairWindow('2026-10-10', '2026-11-10')).toBe(false) // 31 天
    expect(REPAIR_WINDOW_DAYS).toBe(30)
  })

  it('未来日期不算窗口内', () => {
    expect(isWithinRepairWindow('2026-11-11', '2026-11-10')).toBe(false)
  })

  it('daysBetweenKeys 跨月正确', () => {
    expect(daysBetweenKeys('2026-10-31', '2026-11-01')).toBe(1)
  })
})
