/** 桌宠角色尺寸与形象（形象来自旧版正面投影渲染器；cat/bot 由专属蓝图解锁） */
import type { PetModel } from '../types'

export type PetSize = 'small' | 'medium' | 'large'
export type PetSkin = PetModel

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
  if (size === 'small') return 0.8
  if (size === 'large') return 1.05
  return 0.9
}

/** 主窗 → pet 窗口的配置与打卡进度（Tauri 事件 `pet-config`） */
export interface PetConfig {
  size: PetSize
  skin: PetSkin
  roam: boolean
  /** 自定义材质色；空 = 跟随主题 */
  color?: string
  /** 当前已解锁的蓝图形象；由主窗按建造进度计算 */
  unlocked?: PetSkin[]
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

/** 桌宠形象由专属蓝图完成情况决定（旧版 pet-cat / pet-bot 数据） */
export { PET_MODELS, petBlueprintId, resolvePetModel } from '../logic/petModels'
