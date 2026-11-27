import type {
  AppSettings,
  AppState,
  CheckInResult,
  ClaimDayResult,
  Habit,
  HabitExtra,
  Language,
  MicroMood,
  Theme,
  UndoResult
} from '../types'

/**
 * appStore 的类型契约（纯类型模块，无运行时副作用）：
 * AppActions 是全部 action 的签名，AppStore 是状态 + action + 运行时水合字段的合成类型。
 */
interface AppActions {
  addHabit(name: string, frequency: Habit['frequency'], extra?: HabitExtra): Habit
  updateHabit(
    id: string,
    patch: Partial<
      Pick<
        Habit,
        | 'name'
        | 'frequency'
        | 'period'
        | 'reminder'
        | 'targetMinutes'
        | 'targetValue'
        | 'unit'
        | 'step'
        | 'category'
        | 'pinned'
        | 'note'
      >
    >
  ): void
  archiveHabit(id: string): void
  /** 永久删除习惯及其打卡记录 */
  deleteHabit(id: string): void
  /** 恢复归档的习惯 */
  restoreHabit(id: string): void
  /** 置顶/取消置顶习惯 */
  togglePinHabit(id: string): void
  /**
   * 记录或修改某次打卡的笔记/随笔反思及心境、星标。
   * - `mood: null` 清除预设心境；`moodNote` 非空时清除预设心境（两者互斥）
   * - `moodNote: ''` 清除自定义心境
   * D-20261126-118：新增 moodNote 以支持用户自定义心境文本。
   */
  recordCheckInNote(
    checkInId: string,
    note: string,
    mood?: MicroMood | null,
    starred?: boolean,
    moodNote?: string | null
  ): void
  toggleCheckInStar(checkInId: string): void
  /** 记录蓝图落成奠基石铭言 */
  setFoundationNote(blueprintId: string, noteText: string): void
  /** 单个任务打卡：记录完成，并为当前蓝图掉落 1 块积木（支持计数步进与随笔笔记、微状态、星标） */
  checkIn(
    habitId: string,
    actualMinutes?: number,
    note?: string,
    counterDelta?: number,
    mood?: MicroMood,
    starred?: boolean
  ): CheckInResult
  uncheckIn(habitId: string, day?: string): UndoResult
  /** 每日大满贯打卡：全部任务完成后领取额外里程碑奖励积木 */
  checkInDay(): ClaimDayResult
  /** 消耗 1 块修复积木挽回过去某天的遗漏打卡 */
  /** 结算本月修复积木额度（幂等；启动与进入统计页时调用） */
  refreshRepairAllowance(): void
  useRepairBrick(habitId: string, date: string): { ok: boolean; reason?: string }
  /**
   * 展台沙盘位置调整（带 AABB 碰撞检测）。
   * rotations：可选的「本次会话 90° 象限」表（蓝图 id → 0/1/2/3），
   * 只参与碰撞/边界校验、不写进存档——装饰模式拖拽时用它复用与渲染一致的占地。
   */
  updateShowcasePlacement(
    blueprintId: string,
    gridX: number,
    gridY: number,
    rotations?: Record<string, number>
  ): boolean
  chooseBlueprint(id: string): void
  updateSettings(patch: Partial<AppSettings>): void
  /** 跳过某习惯今天的到点提醒（持久化到 reminderLog，跨重启当天沉默） */
  skipReminderToday(habitId: string): void
  setTheme(t: Theme): void
  setLanguage(l: Language): void
  exportData(): string
  importData(json: string): boolean
}

export type AppStore = AppState &
  AppActions & {
    hydrated: boolean
    saveError?: number
    needsUpgrade?: boolean
    /** 读档失败（IO/权限/占用）：持久化已挂起，避免空态覆盖真实存档 */
    loadFailed?: boolean
    /** 存档损坏且原文已备份（.corrupt-backup），需提示用户不要静默清空 */
    dataCorrupt?: boolean
  }
