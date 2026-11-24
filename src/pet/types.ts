/** 桌宠角色尺寸与形象（形象来自旧版正面投影渲染器） */
export type PetSize = 'small' | 'medium' | 'large'
export type PetSkin = 'block' | 'robot'

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

/** 积木默认可用；机器人完成 1 座建筑后解锁（后续可扩展更多模型） */
export function isPetSkinUnlocked(skin: PetSkin, completedCount: number): boolean {
  if (skin === 'block') return true
  return completedCount >= 1
}
