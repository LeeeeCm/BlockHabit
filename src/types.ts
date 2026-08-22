export interface Habit {
  id: string
  name: string
  frequency: { type: 'daily' } | { type: 'weekly'; times: number }
  createdAt: string
  archivedAt?: string
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
}

export interface CheckInResult {
  placed?: BlockDef
  bonus: boolean
  complete: boolean
  reason?: 'no-habit' | 'archived' | 'already' | 'weekly-full'
}
