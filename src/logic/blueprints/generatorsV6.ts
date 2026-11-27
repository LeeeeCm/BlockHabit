import type { Blueprint } from '../../types'
import { createBlueprintBuilder } from './generators'

/**
 * 内容包 v6「城市与生活 III」12 座（D-20261128-131）。
 *
 * 追加在既有 23 座之后，不改既有坐标/块数/顺序。颜色全部取自
 * palette.ts 的 D-067 批准材质调色板；正面统一为 y 最大侧。
 * 每座 80–120 块、4–12 层、坐标唯一、无完全悬空、装饰 3–10 处。
 */

/** 火车站：石基 + 浅色站房 + 红陶屋顶 + 站台钟（112 块 / 4 层） */
export function makeStationBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#94a3b8'
  const C_WALL = '#e2e8f0'
  const C_ROOF = '#b4533c'
  const C_DOOR = '#78350f'
  const C_WIN = '#d97706'
  const C_CLOCK = '#f59e0b'

  b.fill(0, 6, 0, 3, 0, 0, 'basic', C_BASE)
  b.fill(0, 6, 0, 3, 1, 2, 'basic', C_WALL)
  b.fill(0, 6, 0, 3, 3, 3, 'basic', C_ROOF)
  b.put(3, 3, 1, 'gate', C_DOOR)
  b.put(1, 3, 1, 'window', C_WIN)
  b.put(5, 3, 1, 'window', C_WIN)
  b.put(0, 3, 2, 'window', C_WIN)
  b.put(1, 3, 2, 'window', C_WIN)
  b.put(3, 3, 2, 'basic', C_CLOCK)
  b.put(5, 3, 2, 'window', C_WIN)
  b.put(6, 3, 2, 'window', C_WIN)
  return b.build('station', 3, 1)
}

/** 剧院：石基 + 浅色观众厅 + 红陶檐口 + 黄铜门楣（95 块 / 5 层） */
export function makeTheaterBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#94a3b8'
  const C_WALL = '#f1f5f9'
  const C_ROOF = '#b4533c'
  const C_DOOR = '#78350f'
  const C_WIN = '#d97706'
  const C_SIGN = '#f59e0b'

  b.fill(0, 5, 0, 3, 0, 0, 'basic', C_BASE)
  b.fill(0, 5, 0, 3, 1, 2, 'basic', C_WALL)
  b.fill(0, 4, 1, 3, 3, 3, 'basic', C_ROOF)
  b.fill(1, 4, 1, 2, 4, 4, 'basic', C_WALL)
  b.put(2, 3, 1, 'gate', C_DOOR)
  b.put(3, 3, 1, 'gate', C_DOOR)
  b.put(1, 3, 1, 'window', C_WIN)
  b.put(4, 3, 1, 'window', C_WIN)
  b.put(1, 3, 2, 'window', C_WIN)
  b.put(4, 3, 2, 'window', C_WIN)
  b.put(2, 3, 2, 'basic', C_SIGN)
  b.put(3, 3, 2, 'basic', C_SIGN)
  b.put(2, 2, 4, 'window', C_WIN)
  b.put(3, 2, 4, 'window', C_WIN)
  return b.build('theater', 2, 1)
}

/** 博物馆：大台阶 + 柱廊 + 山花（102 块 / 5 层） */
export function makeMuseumBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_STEPS = '#cbd5e1'
  const C_WALL = '#f8fafc'
  const C_ROOF = '#334155'
  const C_COLUMN = '#94a3b8'
  const C_PEDIMENT = '#b4533c'
  const C_DOOR = '#78350f'
  const C_WIN = '#0284c7'

  b.fill(0, 7, 0, 4, 0, 0, 'basic', C_STEPS)
  b.fill(1, 6, 1, 3, 1, 2, 'basic', C_WALL)
  b.fill(1, 6, 1, 3, 3, 3, 'basic', C_ROOF)
  b.fill(2, 5, 1, 2, 4, 4, 'basic', C_PEDIMENT)
  b.put(1, 3, 1, 'basic', C_COLUMN)
  b.put(1, 3, 2, 'basic', C_COLUMN)
  b.put(6, 3, 1, 'basic', C_COLUMN)
  b.put(6, 3, 2, 'basic', C_COLUMN)
  b.put(3, 3, 1, 'gate', C_DOOR)
  b.put(2, 3, 1, 'window', C_WIN)
  b.put(4, 3, 1, 'window', C_WIN)
  b.put(2, 3, 2, 'window', C_WIN)
  b.put(4, 3, 2, 'window', C_WIN)
  return b.build('museum', 3, 2)
}

/** 医院：石基 + 白墙 + 屋顶红十字与玻璃窗（99 块 / 6 层） */
export function makeHospitalBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#94a3b8'
  const C_WALL = '#f1f5f9'
  const C_ROOF = '#334155'
  const C_DOOR = '#78350f'
  const C_WIN = '#0284c7'
  const C_CROSS = '#e11d48'

  b.fill(0, 5, 0, 3, 0, 0, 'basic', C_BASE)
  b.fill(0, 5, 0, 3, 1, 2, 'basic', C_WALL)
  b.fill(0, 5, 0, 3, 3, 3, 'basic', C_ROOF)
  b.put(2, 3, 1, 'gate', C_DOOR)
  b.put(1, 3, 1, 'window', C_WIN)
  b.put(4, 3, 1, 'window', C_WIN)
  b.put(1, 3, 2, 'window', C_WIN)
  b.put(4, 3, 2, 'window', C_WIN)
  // 屋顶红十字：横三块 + 竖两块（落在屋顶上，不悬空）
  b.put(2, 3, 3, 'basic', C_CROSS)
  b.put(3, 3, 3, 'basic', C_CROSS)
  b.put(4, 3, 3, 'basic', C_CROSS)
  b.put(3, 3, 4, 'basic', C_CROSS)
  b.put(3, 3, 5, 'basic', C_CROSS)
  return b.build('hospital', 2, 1)
}

/** 学校：红砖校舍 + 浅色钟塔 + 黄铜钟（95 块 / 5 层） */
export function makeSchoolBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#94a3b8'
  const C_WALL = '#b4533c'
  const C_ROOF = '#334155'
  const C_TOWER = '#f1f5f9'
  const C_DOOR = '#78350f'
  const C_WIN = '#d97706'
  const C_BELL = '#f59e0b'

  b.fill(0, 5, 0, 3, 0, 0, 'basic', C_BASE)
  b.fill(0, 5, 0, 3, 1, 2, 'basic', C_WALL)
  b.fill(0, 4, 1, 3, 3, 3, 'basic', C_ROOF)
  b.fill(4, 5, 0, 1, 3, 4, 'basic', C_TOWER)
  b.put(2, 3, 1, 'gate', C_DOOR)
  b.put(1, 3, 1, 'window', C_WIN)
  b.put(4, 3, 1, 'window', C_WIN)
  b.put(1, 3, 2, 'window', C_WIN)
  b.put(4, 3, 2, 'window', C_WIN)
  b.put(5, 1, 4, 'window', C_BELL)
  b.put(4, 0, 4, 'basic', C_BELL)
  return b.build('school', 2, 1)
}

/** 教堂：石基 + 白墙 + 红陶尖塔与金色十字（105 块 / 8 层） */
export function makeChapelBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#94a3b8'
  const C_WALL = '#f1f5f9'
  const C_ROOF = '#334155'
  const C_STEEPLE = '#b4533c'
  const C_DOOR = '#78350f'
  const C_WIN = '#0284c7'
  const C_CROSS = '#f59e0b'

  b.fill(0, 4, 0, 3, 0, 0, 'basic', C_BASE)
  b.fill(0, 4, 0, 3, 1, 3, 'basic', C_WALL)
  b.fill(0, 3, 1, 3, 4, 4, 'basic', C_ROOF)
  b.fill(3, 4, 0, 1, 4, 6, 'basic', C_STEEPLE)
  b.put(2, 3, 1, 'gate', C_DOOR)
  b.put(1, 3, 2, 'window', C_WIN)
  b.put(0, 3, 2, 'window', C_WIN)
  b.put(4, 3, 2, 'window', C_WIN)
  // 金色十字：竖向三块落在尖塔上，顶部再一块
  b.put(3, 0, 4, 'basic', C_CROSS)
  b.put(3, 0, 5, 'basic', C_CROSS)
  b.put(3, 0, 6, 'basic', C_CROSS)
  b.put(4, 0, 5, 'basic', C_CROSS)
  b.put(3, 0, 7, 'basic', C_CROSS)
  return b.build('chapel', 2, 1)
}

/** 寺庙：石基 + 朱红墙 + 双层木构屋顶（98 块 / 7 层） */
export function makeTempleBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#94a3b8'
  const C_WALL = '#b4533c'
  const C_ROOF = '#78350f'
  const C_UPPER = '#854d0e'
  const C_DOOR = '#4a2c1d'
  const C_WIN = '#d97706'

  b.fill(0, 4, 0, 3, 0, 0, 'basic', C_BASE)
  b.fill(0, 4, 0, 3, 1, 2, 'basic', C_WALL)
  b.fill(0, 4, 0, 3, 3, 3, 'basic', C_ROOF)
  b.fill(1, 3, 1, 2, 4, 5, 'basic', C_UPPER)
  b.fill(1, 3, 1, 2, 6, 6, 'basic', C_ROOF)
  b.put(2, 3, 1, 'gate', C_DOOR)
  b.put(1, 3, 1, 'window', C_WIN)
  b.put(3, 3, 1, 'window', C_WIN)
  b.put(1, 3, 2, 'window', C_WIN)
  b.put(3, 3, 2, 'window', C_WIN)
  b.put(1, 3, 5, 'window', C_WIN)
  b.put(3, 3, 5, 'window', C_WIN)
  return b.build('temple', 2, 1)
}

/** 旋转木马：八角台座 + 中央木柱 + 暖光彩顶与木马（96 块 / 7 层） */
export function makeCarouselBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#a89f91'
  const C_COLUMN = '#b4533c'
  const C_ROOF_A = '#f59e0b'
  const C_ROOF_B = '#f1f5f9'
  const C_TRIM = '#334155'
  const C_HORSE = '#e9c46a'
  const C_DOOR = '#4a2c1d'

  // 八角台座 z0：7×7 去掉四角
  for (let x = 0; x <= 6; x++) {
    for (let y = 0; y <= 6; y++) {
      const corner = (x === 0 || x === 6) && (y === 0 || y === 6)
      if (!corner) b.put(x, y, 0, 'basic', C_BASE)
    }
  }
  // 中央木柱 2×2 ×3 层
  b.fill(3, 4, 3, 4, 1, 3, 'basic', C_COLUMN)
  // 木马 / 座位：z1 四向各一
  for (const [x, y] of [
    [1, 3],
    [5, 3],
    [3, 1],
    [3, 5]
  ] as const) {
    b.put(x, y, 1, 'basic', C_HORSE)
  }
  // 彩顶 5×5（z4，去四角）+ 3×3（z5）+ 顶饰（z6）
  for (let x = 1; x <= 5; x++) {
    for (let y = 1; y <= 5; y++) {
      const corner = (x === 1 || x === 5) && (y === 1 || y === 5)
      if (!corner) b.put(x, y, 4, 'basic', (x + y) % 2 === 0 ? C_ROOF_A : C_ROOF_B)
    }
  }
  b.fill(2, 4, 2, 4, 5, 5, 'basic', C_ROOF_A)
  b.put(3, 3, 6, 'basic', C_TRIM)
  b.put(3, 4, 1, 'gate', C_DOOR)
  b.put(2, 3, 4, 'window', C_TRIM)
  b.put(4, 3, 4, 'window', C_TRIM)
  return b.build('carousel', 3, 3)
}

/** 码头：木栈桥 + 石砌小屋 + 板岩屋顶 + 灯柱（100 块 / 5 层） */
export function makePierBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_DECK = '#854d0e'
  const C_POST = '#78350f'
  const C_HUT = '#a89f91'
  const C_ROOF = '#334155'
  const C_RAIL = '#4a2c1d'
  const C_LAMP = '#f59e0b'
  const C_DOOR = '#4a2c1d'
  const C_WIN = '#d97706'

  // 10×3 木栈桥（z1）+ 8 根桥柱（z0）
  b.fill(0, 9, 0, 2, 1, 1, 'basic', C_DECK)
  for (const x of [0, 3, 6, 9]) {
    for (const y of [0, 2]) b.put(x, y, 0, 'basic', C_POST)
  }
  // 石砌小屋 4×3（z2-3）+ 板岩屋顶 6×4（z4）
  b.fill(3, 6, 0, 2, 2, 3, 'basic', C_HUT)
  b.fill(2, 7, 0, 3, 4, 4, 'basic', C_ROOF)
  // 栏杆（z2）：栈桥两翼
  b.fill(0, 2, 0, 0, 2, 2, 'basic', C_RAIL)
  b.fill(0, 2, 2, 2, 2, 2, 'basic', C_RAIL)
  b.fill(7, 9, 0, 0, 2, 2, 'basic', C_RAIL)
  b.fill(7, 9, 2, 2, 2, 2, 'basic', C_RAIL)
  // 灯柱与门窗
  b.put(0, 0, 2, 'basic', C_LAMP)
  b.put(9, 2, 2, 'basic', C_LAMP)
  b.put(4, 2, 2, 'gate', C_DOOR)
  b.put(3, 2, 2, 'window', C_WIN)
  b.put(5, 2, 2, 'window', C_WIN)
  b.put(4, 2, 3, 'window', C_WIN)
  return b.build('pier', 4, 1)
}

/** 喷泉：石砌圆池 + 中央红陶柱 + 清水与黄铜出水口（116 块 / 6 层） */
export function makeFountainBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#94a3b8'
  const C_BASIN = '#cbd5e1'
  const C_COLUMN = '#b4533c'
  const C_BOWL = '#f1f5f9'
  const C_WATER = '#0284c7'
  const C_SPOUT = '#f59e0b'

  // 7×7 石台（z0）+ 环形池沿（z1）+ 中央水面（z1）
  b.fill(0, 6, 0, 6, 0, 0, 'basic', C_BASE)
  for (let x = 0; x <= 6; x++) {
    for (let y = 0; y <= 6; y++) {
      const inCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4
      if (!inCenter) b.put(x, y, 1, 'basic', C_BASIN)
      else b.put(x, y, 1, 'window', C_WATER)
    }
  }
  // 中央红陶柱（z2-3）+ 白池（z4）+ 黄铜出水口（z5）
  b.fill(3, 4, 3, 4, 2, 3, 'basic', C_COLUMN)
  b.fill(2, 4, 2, 4, 4, 4, 'basic', C_BOWL)
  b.put(3, 3, 5, 'basic', C_SPOUT)
  return b.build('fountain', 3, 3)
}

/** 集市：石台 + 三座木摊 + 暖色/浅色/红陶雨棚 + 货箱（85 块 / 4 层） */
export function makeMarketBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#a89f91'
  const C_POST = '#78350f'
  const C_AWNING_A = '#f59e0b'
  const C_AWNING_B = '#f1f5f9'
  const C_AWNING_C = '#b4533c'
  const C_CRATE = '#c69c6d'
  const C_PRODUCE = '#e9c46a'
  const C_LAMP = '#f59e0b'
  const C_DOOR = '#4a2c1d'

  b.fill(0, 7, 0, 5, 0, 0, 'basic', C_BASE)
  const awningColors = [C_AWNING_A, C_AWNING_B, C_AWNING_C]
  for (let i = 0; i < 3; i++) {
    const x0 = i * 3
    // 两柱（z1-2）+ 雨棚（z3）+ 货箱（z1）+ 摊位门
    b.put(x0, 3, 1, 'basic', C_POST)
    b.put(x0 + 1, 3, 1, 'basic', C_POST)
    b.put(x0, 3, 2, 'basic', C_POST)
    b.put(x0 + 1, 3, 2, 'basic', C_POST)
    b.fill(x0, x0 + 1, 4, 5, 3, 3, 'basic', awningColors[i])
    b.put(x0, 4, 1, 'basic', C_CRATE)
    b.put(x0 + 1, 4, 1, 'basic', C_PRODUCE)
  }
  for (let i = 0; i < 3; i++) b.put(i * 3, 5, 1, 'gate', C_DOOR)
  b.put(2, 5, 1, 'basic', C_LAMP)
  b.put(7, 5, 1, 'basic', C_LAMP)
  return b.build('market', 3, 2)
}

/** 体育馆：石台 + 双层看台 + 绿色球场 + 灯塔与记分牌（102 块 / 4 层） */
export function makeStadiumBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#94a3b8'
  const C_FIELD = '#4f776a'
  const C_TIER = '#cbd5e1'
  const C_TRIM = '#b4533c'
  const C_LAMP = '#f59e0b'
  const C_SCORE = '#0284c7'
  const C_DOOR = '#78350f'

  b.fill(0, 7, 0, 5, 0, 0, 'basic', C_BASE)
  // 内场 6×4 覆色（不增加块数）
  b.fill(1, 6, 1, 4, 0, 0, 'basic', C_FIELD)
  // 双层看台：8×6 周圈（z1-2）
  for (let z = 1; z <= 2; z++) {
    for (let x = 0; x <= 7; x++) {
      b.put(x, 0, z, 'basic', z === 1 ? C_TIER : C_TRIM)
      b.put(x, 5, z, 'basic', z === 1 ? C_TIER : C_TRIM)
    }
    for (let y = 1; y <= 4; y++) {
      b.put(0, y, z, 'basic', z === 1 ? C_TIER : C_TRIM)
      b.put(7, y, z, 'basic', z === 1 ? C_TIER : C_TRIM)
    }
  }
  // 四角灯塔（z3）+ 正面记分牌
  for (const [x, y] of [
    [0, 0],
    [7, 0],
    [0, 5],
    [7, 5]
  ] as const) {
    b.put(x, y, 3, 'basic', C_LAMP)
  }
  b.put(3, 5, 3, 'basic', C_SCORE)
  b.put(4, 5, 3, 'basic', C_SCORE)
  // 入口与侧窗
  b.put(3, 5, 1, 'gate', C_DOOR)
  b.put(4, 5, 1, 'gate', C_DOOR)
  b.put(2, 5, 2, 'window', C_SCORE)
  b.put(5, 5, 2, 'window', C_SCORE)
  b.put(0, 2, 1, 'window', C_SCORE)
  return b.build('stadium', 3, 2)
}
