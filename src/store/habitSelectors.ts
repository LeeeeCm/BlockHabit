import type { CheckIn, Habit } from '../types'
import { dayCheckInsFor, dayCounterValue, weekCountFor } from '../logic/checkin'

export interface HabitCheckInSlice {
  todayCheckIns: CheckIn[]
  todayCheckIn: CheckIn | undefined
  counterVal: number
  weekCount: number
}

interface CacheEntry {
  rawCheckIns: CheckIn[]
  slice: HabitCheckInSlice
  day: string
  kind?: string
  frequencyType: string
}

const sliceCache = new Map<string, CacheEntry>()

/**
 * 清空选择器缓存（供测试重置与全局重置使用）
 */
export function clearHabitSliceCache(): void {
  sliceCache.clear()
}

function checkInItemsEqual(a: CheckIn, b: CheckIn): boolean {
  if (a === b) return true
  return (
    a.id === b.id &&
    a.habitId === b.habitId &&
    a.date === b.date &&
    a.value === b.value &&
    a.actualMinutes === b.actualMinutes &&
    a.note === b.note &&
    a.mood === b.mood &&
    Boolean(a.starred) === Boolean(b.starred) &&
    a.deletedAt === b.deletedAt
  )
}

/**
 * 针对指定习惯在指定日期的切片选择器（带内容等价缓存）：
 * 只要本习惯的打卡事实未发生变动，无论整表其他习惯如何打卡，均返回上一轮缓存的同一个对象引用。
 * 配合 zustand 默认的 Object.is 比较，达成"无关打卡零重渲染"。
 */
export function selectHabitCheckInSlice(
  checkIns: CheckIn[],
  habit: Habit,
  day: string,
): HabitCheckInSlice {
  const habitId = habit.id
  // 仅筛选属于本习惯的打卡
  const habitCheckIns = checkIns.filter((c) => c.habitId === habitId)
  const cached = sliceCache.get(habitId)

  if (
    cached &&
    cached.day === day &&
    cached.kind === habit.kind &&
    cached.frequencyType === habit.frequency.type
  ) {
    const prevRaw = cached.rawCheckIns
    if (prevRaw === habitCheckIns) {
      return cached.slice
    }
    if (prevRaw.length === habitCheckIns.length) {
      let identical = true
      for (let i = 0; i < prevRaw.length; i++) {
        if (!checkInItemsEqual(prevRaw[i], habitCheckIns[i])) {
          identical = false
          break
        }
      }
      if (identical) {
        return cached.slice
      }
    }
  }

  const todayCheckIns = dayCheckInsFor(habitCheckIns, habitId, day)
  const todayCheckIn = todayCheckIns[todayCheckIns.length - 1]
  const counterVal = habit.kind === 'counter' ? dayCounterValue(todayCheckIns, habitId, day) : 0
  const weekCount = habit.frequency.type === 'weekly' ? weekCountFor(habitCheckIns, habitId, day) : 0

  const slice: HabitCheckInSlice = {
    todayCheckIns,
    todayCheckIn,
    counterVal,
    weekCount,
  }

  sliceCache.set(habitId, {
    rawCheckIns: habitCheckIns,
    slice,
    day,
    kind: habit.kind,
    frequencyType: habit.frequency.type,
  })

  return slice
}
