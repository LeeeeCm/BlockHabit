export type HabitPeriod = 'any' | 'morning' | 'afternoon' | 'evening'

export interface Habit {
  id: string
  name: string
  frequency: { type: 'daily' } | { type: 'weekly'; times: number }
  createdAt: string
  archivedAt?: string
  /** 选填：归属时段 */
  period?: HabitPeriod
  /** 选填：目标时长（分钟） */
  targetMinutes?: number
  /** 选填：备注 */
  note?: string
}

export interface HabitExtra {
  period?: HabitPeriod
  targetMinutes?: number
  note?: string
}

export interface CheckIn {
  id: string
  habitId: string
  /** 本地时区 YYYY-MM-DD */
  date: string
  at: string
  rewardBlockIndex?: number
}

export type BlockType = 'basic' | 'flag' | 'window' | 'gate' | 'chimney'

export interface BlockDef {
  x: number
  y: number
  z: number
  type: BlockType
}

export interface Blueprint {
  id: string
  name: string
  /** 数组顺序即拼建顺序：自下而上、由内向外 */
  blocks: BlockDef[]
}

export interface PlacedBlock {
  id: string
  blueprintId: string
  index: number
  placedAt: string
  fromHabitId: string
  /** 连击里程碑奖励块：点缀色描边渲染 */
  bonus: boolean
}

export type Theme = 'light' | 'dark'

export interface AppState {
  schemaVersion: 1
  habits: Habit[]
  checkIns: CheckIn[]
  builds: PlacedBlock[]
  activeBlueprintId: string
  completedBlueprintIds: string[]
  settings: { theme: Theme }
  /** 每日全任务完成后领取积木的日期（YYYY-MM-DD） */
  dayClaims: string[]
}

export interface CheckInResult {
  placed?: BlockDef
  bonus: boolean
  complete: boolean
  reason?: 'no-habit' | 'archived' | 'already' | 'weekly-full'
}

export interface ClaimDayResult {
  placed?: BlockDef
  bonus: boolean
  complete: boolean
  reason?: 'no-habits' | 'incomplete' | 'already'
}
