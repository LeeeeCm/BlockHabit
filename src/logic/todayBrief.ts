/**
 * 今日简报的纯计算（D-20261110-052）。
 *
 * 为什么单独成模块：问候语的时段边界、完成计数、下一里程碑都是规则，
 * 放进 Today.tsx 只能靠手测；抽到逻辑层后可单测，且组件保持纯展示。
 */
import type { CheckIn, Habit } from '../types'
import { habitMetOnDay } from './checkin'
import { blueprintOrder, getBlueprint } from './blueprints'

export type GreetingKey = 'night' | 'morning' | 'noon' | 'afternoon' | 'evening'

export interface TodayBriefInput {
  now: Date
  /** 本地时区日期键（useTodayKey） */
  day: string
  habits: Habit[]
  checkIns: CheckIn[]
  builds: Array<{ blueprintId: string }>
  activeBlueprintId: string
  /** 仅用于「开始第一个」的目标范围（如当前分类筛选后的列表）；缺省用全部在册习惯 */
  targetHabits?: Habit[]
  /** 已落成蓝图：用于跳过回绕后已经建成的「下一座」 */
  completedBlueprintIds?: string[]
}

export interface TodayBriefState {
  /** 有在册习惯且尚未全部完成时才展示 */
  show: boolean
  greeting: GreetingKey
  total: number
  done: number
  pending: number
  /** 当前蓝图还差多少块落成（≥0） */
  remainingBlocks: number
  /** 当前蓝图 id（用于显示「还差几块落成」与蓝图名） */
  activeBlueprintId: string
  /** 当前蓝图已满时，按蓝图顺序给出的下一座 id */
  nextBlueprintId?: string
  /** 第一件未完成习惯（按今日页分组顺序：置顶优先，再按 any→morning→afternoon→evening） */
  firstPendingHabitId?: string
}

const PERIOD_ORDER: Habit['period'][] = ['any', 'morning', 'afternoon', 'evening']

/** 问候语时段边界：5–10 早上 / 11–13 中午 / 14–17 下午 / 18–22 晚上 / 其余夜深 */
export function greetingForHour(hour: number): GreetingKey {
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 14) return 'noon'
  if (hour >= 14 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 23) return 'evening'
  return 'night'
}

/** 第一件未完成习惯：与 Today 的渲染顺序一致，保证「开始第一个」滚到用户看到的第一个 */
function findFirstPending(active: Habit[], checkIns: CheckIn[], day: string): string | undefined {
  const pending = active.filter((h) => !habitMetOnDay(h, checkIns, day))
  if (pending.length === 0) return undefined
  for (const period of PERIOD_ORDER) {
    const inPeriod = pending
      .filter((h) => (h.period ?? 'any') === period)
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
    if (inPeriod.length > 0) return inPeriod[0].id
  }
  return pending[0]?.id
}

export function buildTodayBrief(input: TodayBriefInput): TodayBriefState {
  const active = input.habits.filter((h) => !h.archivedAt)
  const total = active.length
  const done = active.filter((h) => habitMetOnDay(h, input.checkIns, input.day)).length
  const pending = total - done
  const blueprint = getBlueprint(input.activeBlueprintId)
  const placed = input.builds.filter((b) => b.blueprintId === input.activeBlueprintId).length
  const remainingBlocks = Math.max(0, blueprint.blocks.length - placed)
  const idx = blueprintOrder.indexOf(input.activeBlueprintId)
  // endgame 修正：回绕下一座时跳过已落成蓝图；全部落成时不给出「下一座」
  let nextBlueprintId: string | undefined
  if (remainingBlocks === 0 && idx >= 0) {
    const completed = new Set(input.completedBlueprintIds ?? [])
    for (let step = 1; step < blueprintOrder.length; step++) {
      const candidate = blueprintOrder[(idx + step) % blueprintOrder.length]
      if (candidate !== input.activeBlueprintId && !completed.has(candidate)) {
        nextBlueprintId = candidate
        break
      }
    }
  }
  return {
    show: total > 0 && pending > 0,
    greeting: greetingForHour(input.now.getHours()),
    total,
    done,
    pending,
    remainingBlocks,
    activeBlueprintId: input.activeBlueprintId,
    nextBlueprintId,
    firstPendingHabitId: findFirstPending(input.targetHabits ?? active, input.checkIns, input.day),
  }
}
