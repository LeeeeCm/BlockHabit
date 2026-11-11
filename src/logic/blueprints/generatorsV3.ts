import type { Blueprint } from '../../types'
import { createBlueprintBuilder } from './generators'

/**
 * 内容包 v3「城市与生活」续章 5 座（D-20261111-070）。
 *
 * 与 generators.ts 拆开的原因：既有 18 座生成器已 671 行，AGENTS §4 规定单文件
 * 超过 800 行时新增逻辑应拆到新文件。本文件只做追加，不触碰既有 18 座数据
 * （建筑数据属设计性资产，见 AGENTS §2）。
 *
 * 约束（content.test / palette.test 校验）：
 * - 块数：bakery 98 / bookshop 104 / postoffice 92 / firestation 112 / watertower 94（合计 500）
 * - 每座 4–12 层、坐标唯一、无完全悬空、只用 basic/window/gate、装饰 3–10 处
 * - 颜色全部取自 palette.ts 的批准材质调色板（不新增 hex）
 * 正面统一为 y 最大侧（与既有模型一致）。
 */

/** 街角面包房：石砌矮基 + 红砖两层 + 木雨棚与暖窗（98 块 / 5 层） */
export function makeBakeryBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#94a3b8' // 石砌勒脚
  const C_BRICK = '#b4533c' // 红砖墙
  const C_TIMBER = '#78350f' // 木雨棚/木门
  const C_PLASTER = '#f1f5f9' // 白灰抹面上层
  const C_ROOF = '#334155' // 板岩屋顶
  const C_WIN = '#d97706' // 暖光橱窗
  const C_SIGN = '#f59e0b' // 黄铜店招

  // 石砌基座 5×5（z0）
  b.fill(0, 4, 0, 4, 0, 0, 'basic', C_BASE)
  // 一层红砖 5×5（z1）+ 店门与临街橱窗
  b.fill(0, 4, 0, 4, 1, 1, 'basic', C_BRICK)
  b.put(2, 4, 1, 'gate', C_TIMBER)
  b.put(1, 4, 1, 'window', C_WIN)
  b.put(3, 4, 1, 'window', C_WIN)
  // 二层红砖 4×4 退台（z2）+ 街角窗
  b.fill(0, 3, 0, 3, 2, 2, 'basic', C_BRICK)
  b.put(1, 3, 2, 'window', C_WIN)
  // 木雨棚 4 块挑在一层橱窗上方（z2，正下方即 z1 砖块，不悬空）
  b.put(0, 4, 2, 'basic', C_TIMBER)
  b.put(1, 4, 2, 'basic', C_TIMBER)
  b.put(2, 4, 2, 'basic', C_SIGN)
  b.put(3, 4, 2, 'basic', C_TIMBER)
  // 白灰抹面上层 4×4（z3）+ 暖窗
  b.fill(0, 3, 0, 3, 3, 3, 'basic', C_PLASTER)
  b.put(1, 3, 3, 'window', C_WIN)
  b.put(2, 3, 3, 'window', C_WIN)
  // 板岩屋顶 3×4（z4）
  b.fill(1, 3, 0, 3, 4, 4, 'basic', C_ROOF)
  return b.build('bakery', 2, 2)
}

/** 旧书店：石基 + 红砖底商 + 白灰二层 + 木构屋架与烟囱（104 块 / 6 层） */
export function makeBookshopBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#94a3b8' // 石砌基座
  const C_BRICK = '#b4533c' // 红砖底商
  const C_PLASTER = '#f1f5f9' // 白灰抹面
  const C_TIMBER = '#854d0e' // 原木屋架
  const C_DOOR = '#78350f' // 木门
  const C_ROOF = '#334155' // 板岩屋顶
  const C_CHIMNEY = '#64748b' // 石砌烟囱
  const C_WIN = '#d97706' // 暖光窗

  // 石砌基座 5×5（z0）
  b.fill(0, 4, 0, 4, 0, 0, 'basic', C_BASE)
  // 红砖底商 5×5（z1）+ 店门/橱窗/侧窗
  b.fill(0, 4, 0, 4, 1, 1, 'basic', C_BRICK)
  b.put(2, 4, 1, 'gate', C_DOOR)
  b.put(1, 4, 1, 'window', C_WIN)
  b.put(3, 4, 1, 'window', C_WIN)
  b.put(0, 2, 1, 'window', C_WIN)
  // 白灰二层 5×5（z2）+ 双窗
  b.fill(0, 4, 0, 4, 2, 2, 'basic', C_PLASTER)
  b.put(1, 4, 2, 'window', C_WIN)
  b.put(3, 4, 2, 'window', C_WIN)
  // 原木阁楼层 4×4（z3）+ 小窗
  b.fill(0, 3, 0, 3, 3, 3, 'basic', C_TIMBER)
  b.put(1, 3, 3, 'window', C_WIN)
  // 板岩屋顶 3×4（z4）；烟囱占屋顶一格并在 z5 出头
  b.fill(1, 3, 0, 3, 4, 4, 'basic', C_ROOF)
  b.put(3, 0, 4, 'basic', C_CHIMNEY)
  b.put(3, 0, 5, 'basic', C_CHIMNEY)
  return b.build('bookshop', 2, 2)
}

/** 邮政所：石砌台基与角柱 + 浅色墙身 + 红陶檐口与暖灯（92 块 / 5 层） */
export function makePostofficeBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#94a3b8' // 石砌台基/角柱
  const C_WALL = '#e2e8f0' // 浅色墙身
  const C_ROOF = '#334155' // 板岩屋顶
  const C_TRIM = '#b4533c' // 红陶檐口
  const C_DOOR = '#78350f' // 木门
  const C_GLASS = '#0284c7' // 蓝玻璃窗
  const C_LAMP = '#f59e0b' // 黄铜门灯

  // 石砌台基 6×5（z0）
  b.fill(0, 5, 0, 4, 0, 0, 'basic', C_BASE)
  // 浅色墙身 6×5（z1）：双开木门 + 两侧竖窗 + 四角石柱
  b.fill(0, 5, 0, 4, 1, 1, 'basic', C_WALL)
  b.put(2, 4, 1, 'gate', C_DOOR)
  b.put(3, 4, 1, 'gate', C_DOOR)
  b.put(1, 4, 1, 'window', C_GLASS)
  b.put(4, 4, 1, 'window', C_GLASS)
  b.put(0, 0, 1, 'basic', C_BASE)
  b.put(5, 0, 1, 'basic', C_BASE)
  b.put(0, 4, 1, 'basic', C_BASE)
  b.put(5, 4, 1, 'basic', C_BASE)
  // 二层墙身 4×4（z2）+ 高窗与门灯
  b.fill(1, 4, 0, 3, 2, 2, 'basic', C_WALL)
  b.put(2, 3, 2, 'window', C_GLASS)
  b.put(3, 3, 2, 'basic', C_LAMP)
  // 板岩屋顶 3×4（z3，与上层墙身同宽，向正面收分）
  b.fill(1, 3, 0, 3, 3, 3, 'basic', C_ROOF)
  // 红陶山花 2×2（z4）
  b.fill(2, 3, 1, 2, 4, 4, 'basic', C_TRIM)
  return b.build('postoffice', 3, 2)
}

/** 消防站：石砌台基 + 两个车库门 + 上部宿舍层 + 训练塔与信号红（112 块 / 6 层） */
export function makeFirestationBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#94a3b8' // 石砌台基
  const C_WALL = '#64748b' // 灰石/水泥墙
  const C_ROOF = '#334155' // 板岩屋顶
  const C_TRIM = '#b4533c' // 红陶檐口线
  const C_DOOR = '#78350f' // 木车库门
  const C_WIN = '#d97706' // 暖光窗
  const C_SIGNAL = '#e11d48' // 信号红（警灯/塔顶，极小面积）

  // 石砌台基 7×5（z0）
  b.fill(0, 6, 0, 4, 0, 0, 'basic', C_BASE)
  // 一层车库层 7×5（z1）：三格车库门 + 侧门 + 侧窗 + 警灯
  b.fill(0, 6, 0, 4, 1, 1, 'basic', C_WALL)
  b.put(1, 4, 1, 'gate', C_DOOR)
  b.put(2, 4, 1, 'gate', C_DOOR)
  b.put(3, 4, 1, 'gate', C_DOOR)
  b.put(5, 4, 1, 'gate', C_DOOR)
  b.put(6, 4, 1, 'window', C_WIN)
  b.put(4, 4, 1, 'basic', C_SIGNAL)
  // 二层宿舍层 5×4（z2）+ 双窗
  b.fill(1, 5, 0, 3, 2, 2, 'basic', C_WALL)
  b.put(2, 3, 2, 'window', C_WIN)
  b.put(4, 3, 2, 'window', C_WIN)
  // 板岩屋顶 5×4（z3），正面前沿两格红陶檐口（识别色）
  b.fill(1, 5, 0, 3, 3, 3, 'basic', C_ROOF)
  b.put(1, 3, 3, 'basic', C_TRIM)
  b.put(2, 3, 3, 'basic', C_TRIM)
  // 训练塔两级（z4-5，塔顶信号红）
  b.put(1, 1, 4, 'basic', C_ROOF)
  b.put(1, 1, 5, 'basic', C_SIGNAL)
  return b.build('firestation', 3, 2)
}

/** 水塔：四角金属腿 + 木斜撑 + 石平台 + 浅色罐体 + 冷光小窗（94 块 / 10 层） */
export function makeWatertowerBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#94a3b8' // 石砌基础/罐顶圈
  const C_LEG = '#475569' // 金属支腿
  const C_BRACE = '#78350f' // 木斜撑
  const C_DECK = '#64748b' // 石平台
  const C_TANK = '#cbd5e1' // 浅色罐体
  const C_ROOF = '#334155' // 罐顶盖
  const C_GLASS = '#0284c7' // 冷光观察窗
  const C_LAMP = '#f59e0b' // 顶灯

  // 石砌基础 4×4（z0）
  b.fill(0, 3, 0, 3, 0, 0, 'basic', C_BASE)
  // 四角支腿（z1-3）
  const LEGS: Array<[number, number]> = [
    [0, 0],
    [3, 0],
    [0, 3],
    [3, 3]
  ]
  for (const [x, y] of LEGS) b.fill(x, x, y, y, 1, 3, 'basic', C_LEG)
  // 木斜撑 4 块（z2，各自与一根支腿同层相邻，不悬空）
  b.put(1, 0, 2, 'basic', C_BRACE)
  b.put(2, 0, 2, 'basic', C_BRACE)
  b.put(0, 1, 2, 'basic', C_BRACE)
  b.put(3, 2, 2, 'basic', C_BRACE)
  // 石平台 4×4（z4，四角落在支腿上，其余同层相接）
  b.fill(0, 3, 0, 3, 4, 4, 'basic', C_DECK)
  // 罐体两层 4×4（z5-6）+ 正面观察窗与检修门
  b.fill(0, 3, 0, 3, 5, 6, 'basic', C_TANK)
  b.put(1, 3, 5, 'window', C_GLASS)
  b.put(2, 3, 5, 'window', C_GLASS)
  b.put(1, 3, 6, 'window', C_GLASS)
  b.put(0, 3, 5, 'gate', C_LEG)
  // 罐顶石圈 3×3（z7）+ 罐顶盖 2×2（z8）+ 顶灯（z9）
  b.fill(0, 2, 0, 2, 7, 7, 'basic', C_BASE)
  b.fill(1, 2, 1, 2, 8, 8, 'basic', C_ROOF)
  b.put(1, 1, 9, 'basic', C_LAMP)
  return b.build('watertower', 2, 2)
}
