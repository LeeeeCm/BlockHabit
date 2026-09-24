export type HabitPeriod = 'any' | 'morning' | 'afternoon' | 'evening'
export type HabitKind = 'instant' | 'focus' | 'counter'
export type HabitFrequency =
  | { type: 'daily' }
  | { type: 'weekly'; times: number }
  | { type: 'custom'; days: number[] } // 1=周一, 2=周二 ... 7=周日

export interface Habit {
  id: string
  name: string
  frequency: HabitFrequency
  createdAt: string
  archivedAt?: string
  /** 习惯形态：瞬时打卡 / 专注计时 / 步进量化 */
  kind?: HabitKind
  /** 选填：归属时段 */
  period?: HabitPeriod
  /** 选填：目标时长（分钟） */
  targetMinutes?: number
  /** 选填：量化目标数值（如 2000ml / 50个） */
  targetValue?: number
  /** 选填：量化单位（如 "ml" / "页" / "个"） */
  unit?: string
  /** 选填：单次步进值（如 250ml） */
  step?: number
  /** 选填：分类标签 */
  category?: string
  /** 选填：置顶标识 */
  pinned?: boolean
  /** 选填：备注 */
  note?: string
}

export interface HabitExtra {
  kind?: HabitKind
  period?: HabitPeriod
  targetMinutes?: number
  targetValue?: number
  unit?: string
  step?: number
  category?: string
  pinned?: boolean
  note?: string
}

export type MicroMood = 'energetic' | 'hard' | 'spark' | 'calm'

export interface CheckIn {
  id: string
  habitId: string
  /** 本地时区 YYYY-MM-DD */
  date: string
  at: string
  rewardBlockIndex?: number
  /** 此次打卡获得的积木 ID（用于撤销打卡时移除） */
  placedBlockId?: string
  /** 实际专注分钟数 */
  actualMinutes?: number
  /** 累积完成数值（counter 习惯） */
  value?: number
  /** 打卡感悟/微日记笔记 */
  note?: string
  /** 微状态心境胶囊 */
  mood?: MicroMood
  /** 精选星标铭文 */
  starred?: boolean
}

export type BlockType = 'basic' | 'window' | 'gate'

export interface BlockDef {
  x: number
  y: number
  z: number
  type: BlockType
  /** 自定义建筑配色（低饱和度经典色，如陶土红棕、鼠尾草绿等） */
  color?: string
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

export interface ShowcasePlacement {
  blueprintId: string
  gridX: number
  gridY: number
}

export type Theme = 'light' | 'dark' | 'oat' | 'fog'
export type Language = 'zh' | 'en'

export interface AppSettings {
  theme: Theme
  language: Language
}

export interface AppState {
  schemaVersion: 1
  habits: Habit[]
  checkIns: CheckIn[]
  builds: PlacedBlock[]
  activeBlueprintId: string
  completedBlueprintIds: string[]
  settings: AppSettings
  /** 每日全任务完成后领取积木的日期（YYYY-MM-DD） */
  dayClaims: string[]
  /** 修复积木库存数量（最高储存 2 块） */
  repairBricks?: number
  /** 展台沙盘模型摆放位置 */
  showcasePlacements?: ShowcasePlacement[]
  /** 蓝图落成奠基石铭言：blueprintId -> noteText */
  foundationNotes?: Record<string, string>
}

export interface CheckInResult {
  placed?: BlockDef
  bonus: boolean
  complete: boolean
  reason?: 'no-habit' | 'archived' | 'already' | 'weekly-full'
  checkInId?: string
}

export interface ClaimDayResult {
  placed?: BlockDef
  bonus: boolean
  complete: boolean
  reason?: 'no-habits' | 'incomplete' | 'already'
}

export interface UndoResult {
  ok: boolean
  habitId: string
  removedBlock?: boolean
  reason?: 'no-checkin' | 'not-found'
}
