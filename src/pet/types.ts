/** 桌宠角色尺寸与材质色（D-20261127-125：只保留积木桌宠一种形态） */
export type PetSize = 'small' | 'medium' | 'large'

/**
 * 可用材质色（全部来自 D-067 已批准的蓝图调色板，不新增色相）。
 * D-20261126-114：从 6 色扩到 11 色，使设置页色板与「跟随主题」正好排成两行六列。
 */
export const PET_COLORS = [
  '#94a3b8',
  '#64748b',
  '#334155',
  '#f1f5f9',
  '#a89f91',
  '#b4533c',
  '#854d0e',
  '#f59e0b',
  '#e9c46a',
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
  roam: boolean
  /** 自定义材质色；空 = 跟随主题 */
  color?: string
  done: number
  total: number
}

export const DEFAULT_PET_CONFIG: PetConfig = {
  size: 'medium',
  roam: true,
  done: 0,
  total: 0
}
