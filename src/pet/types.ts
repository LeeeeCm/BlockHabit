/** 桌宠角色尺寸与形象（形象来自旧版正面投影渲染器） */
export type PetSize = 'small' | 'medium' | 'large'
export type PetSkin = 'block' | 'robot' | 'cat'

/** 可用材质色（全部来自 D-067 已批准的蓝图调色板，不新增色相） */
export const PET_COLORS = [
  '#94a3b8',
  '#f1f5f9',
  '#b4533c',
  '#f59e0b',
  '#0284c7',
  '#4f776a'
] as const

export function normalizePetColor(value: unknown): string | undefined {
  return typeof value === 'string' && (PET_COLORS as readonly string[]).includes(value)
    ? value
    : undefined
}

export function petSizeScale(size: PetSize): number {
  if (size === 'small') return 0.85
  if (size === 'large') return 1.15
  return 1
}

/** 主窗 → pet 窗口的配置与打卡进度（Tauri 事件 `pet-config`） */
export interface PetConfig {
  size: PetSize
  skin: PetSkin
  roam: boolean
  /** 自定义材质色；空 = 跟随主题 */
  color?: string
  done: number
  total: number
  /** 已落成建筑数：机器人形象解锁判定 */
  completed: number
}

export const DEFAULT_PET_CONFIG: PetConfig = {
  size: 'medium',
  skin: 'block',
  roam: true,
  done: 0,
  total: 0,
  completed: 0
}

/** 积木默认可用；机器人完成 1 座建筑后解锁；猫完成 3 座后解锁 */
export function isPetSkinUnlocked(skin: PetSkin, completedCount: number): boolean {
  if (skin === 'block') return true
  if (skin === 'cat') return completedCount >= 3
  return completedCount >= 1
}
