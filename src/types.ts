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
  /** 字段级 LWW 时间戳：任何编辑（含归档/置顶）都会刷新，同步合并时新者胜 */
  updatedAt?: string
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
  /** 删除墓碑：撤销打卡的时间戳；同步合并时删除胜出，防止撤销被并集复活 */
  deletedAt?: string
  /** 此次打卡获得的积木 ID（用于撤销打卡时移除） */
  placedBlockId?: string
  /** 该积木落入的蓝图（v2 起记录，同步后按事实重建积木投影的依据） */
  blueprintId?: string
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
  /** 删除墓碑（撤销打卡/回收全勤块）；合并后积木层由事实重建，此字段仅用于调试 */
  deletedAt?: string
}

/** 每日全勤领取记录：date 是事实主键，blockId 用于撤销时精确回收全勤块 */
export interface DayClaim {
  date: string
  claimedAt: string
  blockId: string
  /** 领取时掉落全勤块的蓝图 */
  blueprintId: string
}

/** 全勤领取的删除墓碑：与 claimedAt 按时间 LWW，支持同日跨设备反复领取/撤销收敛 */
export interface DeletedDayClaim {
  date: string
  deletedAt: string
}

export interface ShowcasePlacement {
  blueprintId: string
  gridX: number
  gridY: number
}

export type Theme = 'light' | 'dark' | 'oat' | 'fog'
export type Language = 'zh' | 'en'
export type SoundMaterial = 'classic' | 'walnut' | 'crystal' | 'metal' | 'mute'

export interface AppSettings {
  theme: Theme
  language: Language
  /** 桌面悬浮微摆件开关 (仅桌面端支持小浮窗，移动端映射为 StandBy 待机钟) */
  enableMiniWidget?: boolean
  /** 时段感知昼夜环境光照 (晨曦/正午/黄昏/夜灯平滑映射) */
  enableAmbientLighting?: boolean
  /** 抗断卡温和风化机制 (Gentle Decay: 晨雾休整期 vs 经典断卡清零) */
  enableGentleDecay?: boolean
  /** 建筑微生态彩蛋 (连胜达到 7/21/100 天孕育植被小径等低多边形彩蛋) */
  enableEcoProps?: boolean
  /** 物理合成 ASMR 敲击音色 (经典/原木/晶体/合金/静音) */
  soundMaterial?: SoundMaterial
  /** 全局静音开关（重启保持） */
  soundMuted?: boolean
  /** 主音量 0~100（默认 100，重启保持） */
  volume?: number
  /** 移动端陀螺仪重力微视差 (默认关闭，遵循 Apple 减弱动态无障碍规范) */
  enableGyroscope?: boolean
  /** 积木透视考古探针模式 (透视幽灵蓝图 + 琥珀色随笔高亮) */
  enableXRayInspection?: boolean
}
export interface AppState {
  schemaVersion: 2
  habits: Habit[]
  checkIns: CheckIn[]
  builds: PlacedBlock[]
  activeBlueprintId: string
  completedBlueprintIds: string[]
  settings: AppSettings
  /** 每日全任务完成后领取积木的记录 */
  dayClaims: DayClaim[]
  /** 全勤领取墓碑 */
  deletedDayClaims?: DeletedDayClaim[]
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
