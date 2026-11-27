/**
 * D-20261127-125：桌宠蓝图已下线，不再注册到蓝图目录。本文件按
 * `AGENTS.md §2` 的不可逆操作规则保留为历史建筑数据；当前没有运行路径引用它。
 */
import type { Blueprint } from '../../types'
import { createBlueprintBuilder } from './generators'

/** 历史数据：pet-cat（已下线） */
export function makePetCatBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  b.fill(0, 2, 1, 1, 0, 1) // 正面三格宽的身体与头部
  b.fill(1, 3, 0, 0, 0, 0) // 背部连向右侧短尾
  b.put(3, 0, 1) // 向上翘一格的尾尖
  b.put(0, 1, 2)(2, 1, 2) // 有各自支撑的两只耳朵
  return b.build('pet-cat', 1, 1)
}

/** 历史数据：pet-bot（已下线） */
export function makePetBotBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  b.fill(1, 2, 0, 1, 0, 2) // 实心的 2×2 躯干、方头
  b.put(0, 1, 1)(3, 1, 1) // 两侧短臂各从肩部悬挑一格
  b.fill(1, 2, 1, 1, 3, 3) // 不分叉的额部轮廓
  return b.build('pet-bot', 1.5, 0.5)
}
