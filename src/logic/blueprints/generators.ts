import type { BlockDef, BlockType, Blueprint } from '../../types'

/**
 * 蓝图生成器：Map 去重，按「自下而上、由内向外」排序，数组顺序即拼建顺序。
 * 装饰只有长在积木上的元素（window / gate），没有旗帜等独立物件。
 */

function key(x: number, y: number, z: number): string {
  return `${x},${y},${z}`
}

export function createBlueprintBuilder() {
  const map = new Map<string, BlockDef>()

  function put(x: number, y: number, z: number, type: BlockType = 'basic', color?: string) {
    map.set(key(x, y, z), { x, y, z, type, color })
    return put
  }

  function fill(
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
    type: BlockType = 'basic',
    color?: string,
  ) {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) map.set(key(x, y, z), { x, y, z, type, color })
    return put
  }

  function build(id: string, name: string, cx: number, cy: number): Blueprint {
    const blocks = [...map.values()].sort((a, b) => {
      if (a.z !== b.z) return a.z - b.z
      const da = Math.abs(a.x - cx) + Math.abs(a.y - cy)
      const db = Math.abs(b.x - cx) + Math.abs(b.y - cy)
      if (da !== db) return da - db
      if (a.x !== b.x) return a.x - b.x
      return a.y - b.y
    })
    return { id, name, blocks }
  }

  return { put, fill, build }
}

/** 灰岩城堡 v2：垛口城墙 + 高低塔楼 + 拱门（约 218 块 / 7 层） */
export function makeCastleBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  // 外墙两圈高（9×9 周边）
  for (let i = 0; i <= 8; i++) {
    for (const [x, y] of [
      [i, 0],
      [i, 8],
      [0, i],
      [8, i],
    ] as const) {
      b.put(x, y, 0)
      b.put(x, y, 1)
    }
  }
  // 城墙垛口：顶面交替锯齿
  for (let i = 0; i <= 8; i++) {
    for (const [x, y] of [
      [i, 0],
      [i, 8],
      [0, i],
      [8, i],
    ] as const) {
      if ((x + y) % 2 === 0) b.put(x, y, 2)
    }
  }
  // 四角 2×2 高塔（6 层）+ 外角封顶
  for (const [tx, ty] of [
    [0, 0],
    [7, 0],
    [0, 7],
    [7, 7],
  ] as const) {
    b.fill(tx, tx + 1, ty, ty + 1, 0, 5)
    b.put(tx === 0 ? 0 : 8, ty === 0 ? 0 : 8, 6)
  }
  // 中央主楼 3×3×4 + 顶上收细两块
  b.fill(3, 5, 3, 5, 0, 3)
  b.put(4, 4, 4)
  b.put(4, 4, 5)
  // 大门 + 门楼窗
  b.put(4, 8, 0, 'gate')
  b.put(4, 8, 1, 'gate')
  // 窗：主楼四面 + 城墙
  b.put(3, 4, 2, 'window')
  b.put(5, 4, 2, 'window')
  b.put(4, 3, 2, 'window')
  b.put(4, 5, 2, 'window')
  for (const [x, y] of [
    [2, 0],
    [6, 0],
    [0, 2],
    [0, 6],
    [8, 2],
    [8, 6],
    [2, 8],
    [6, 8],
  ] as const) {
    b.put(x, y, 1, 'window')
  }
  return b.build('castle', '灰岩城堡', 4, 4)
}

/** 黑白工厂 v2：厂房 + 真积木方柱烟囱（约 175 块） */
export function makeFactoryBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  for (let x = 0; x <= 10; x++) {
    b.put(x, 0, 0)
    b.put(x, 0, 1)
    b.put(x, 6, 0)
    b.put(x, 6, 1)
  }
  for (let y = 1; y <= 5; y++) {
    b.put(0, y, 0)
    b.put(0, y, 1)
    b.put(10, y, 0)
    b.put(10, y, 1)
  }
  b.put(5, 6, 0, 'gate')
  b.put(5, 6, 1, 'gate')
  // 厂房主体 7×5 高 3
  b.fill(2, 8, 1, 5, 0, 2)
  // 天窗
  b.put(3, 3, 2, 'window')
  b.put(5, 3, 2, 'window')
  b.put(7, 3, 2, 'window')
  // 双烟囱：立于厂房顶的 1×1 积木方柱
  b.fill(3, 3, 2, 2, 3, 5)
  b.fill(7, 7, 2, 2, 3, 5)
  return b.build('factory', '黑白工厂', 5, 3)
}

/** 灯塔：宽底座 + 高塔 + 顶灯（约 122 块 / 10 层） */
export function makeLighthouseBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  // 底座 5×5 高 3
  b.fill(0, 4, 0, 4, 0, 2)
  // 塔 3×3 高 5
  b.fill(1, 3, 1, 3, 3, 7)
  // 顶灯（窗）+ 塔尖
  b.put(2, 2, 7, 'window')
  b.fill(1, 3, 1, 3, 8, 8)
  b.put(1, 1, 8, 'window')
  b.put(3, 3, 8, 'window')
  b.put(2, 2, 9)
  b.put(2, 2, 10)
  // 塔身竖排窗
  b.put(1, 2, 4, 'window')
  b.put(1, 2, 6, 'window')
  b.put(3, 2, 5, 'window')
  return b.build('lighthouse', '白岬灯塔', 2, 2)
}

/** 金字塔：9→7→5→3→1 实心阶梯（约 165 块 / 5 层） */
export function makePyramidBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  b.fill(0, 8, 0, 8, 0, 0)
  b.fill(1, 7, 1, 7, 1, 1)
  b.fill(2, 6, 2, 6, 2, 2)
  b.fill(3, 5, 3, 5, 3, 3)
  b.put(4, 4, 4)
  // 正面门洞
  b.put(4, 8, 0, 'gate')
  return b.build('pyramid', '阶梯金字塔', 4, 4)
}

/** 守护机器人 v2：脚掌 + 腿 + 骨盆柱 + 宽躯干 + 单节手臂 + 方头 + 天线（165 块 / 12 层）
 * 正面 = y 最大侧（与城堡 gate 面一致）。躯干 5×3 全部列由“双腿（深 3）+ 中央骨盆柱”垂直支撑，无悬空。 */
export function makeRobotBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  // 脚掌 2×3 ×2（z0）+ 中央骨盆基座（3 块，支撑骨盆柱）
  b.fill(1, 2, 0, 2, 0, 0)
  b.fill(4, 5, 0, 2, 0, 0)
  b.fill(3, 3, 0, 2, 0, 0)
  // 腿部 2×3×3 ×2（z1-3，深度与脚掌/躯干对齐，承托躯干两侧 12 列）
  b.fill(1, 2, 0, 2, 1, 3)
  b.fill(4, 5, 0, 2, 1, 3)
  // 中央 1×3 骨盆柱（z1-3，支撑躯干中段 3 列）
  b.fill(3, 3, 0, 2, 1, 3)
  // 躯干 5×3×4（z4-7）
  b.fill(1, 5, 0, 2, 4, 7)
  // 手臂 1×1 立柱 ×2（z0-6，躯干外侧紧邻）
  b.fill(0, 0, 1, 1, 0, 6)
  b.fill(6, 6, 1, 1, 0, 6)
  // 肩块 2（z7，坐手臂柱顶并与躯干顶缘相接）
  b.put(0, 1, 7)
  b.put(6, 1, 7)
  // 头 3×3×3（z8-10）
  b.fill(2, 4, 0, 2, 8, 10)
  // 眼睛：正面中层（z9）2 个 window
  b.put(2, 2, 9, 'window')
  b.put(4, 2, 9, 'window')
  // 胸前传感器：正面 z6 2 个 window
  b.put(2, 2, 6, 'window')
  b.put(4, 2, 6, 'window')
  // 天线 2（z11，头顶）
  b.put(2, 1, 11)
  b.put(4, 1, 11)
  return b.build('robot', '守护机器人', 3, 1)
}

/** 纪念碑：基座 + 台阶 + 碑身 + 封顶（约 147 块 / 11 层） */
export function makeMonumentBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  b.fill(0, 6, 0, 6, 0, 0) // 基座 7×7
  b.fill(1, 5, 1, 5, 1, 1) // 台阶 5×5
  b.fill(2, 4, 2, 4, 2, 8) // 碑身 3×3×7
  b.fill(2, 4, 2, 4, 9, 9) // 顶盘 3×3
  b.put(3, 3, 10) // 封顶
  // 正面竖列窗
  b.put(3, 4, 3, 'window')
  b.put(3, 4, 5, 'window')
  b.put(3, 4, 7, 'window')
  return b.build('monument', '晨曦纪念碑', 3, 3)
}

/** 桌上仙人掌（陶土红盆 + 鼠尾草灰绿肉茎 + 浅杏花，约 24 块 / 5 层） */
export function makePlantBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_POT = '#b4533c' // 陶土红棕
  const C_RIM = '#9c432f' // 盆沿深陶
  const C_STEM = '#4f776a' // 鼠尾草灰绿
  const C_FLOWER = '#e9c46a' // 顶端金杏花

  // 花盆底座 3×3（实心陶土积木）
  b.fill(0, 2, 0, 2, 0, 0, 'basic', C_POT)
  // 花盆盆沿 3×3
  b.fill(0, 2, 0, 2, 1, 1, 'basic', C_RIM)
  // 仙人掌主干与左右枝干 (z=2)
  b.put(0, 1, 2, 'basic', C_STEM)
  b.put(1, 1, 2, 'basic', C_STEM)
  b.put(2, 1, 2, 'basic', C_STEM)
  // 仙人掌中段 (z=3)
  b.put(0, 1, 3, 'basic', C_STEM)
  b.put(1, 1, 3, 'basic', C_STEM)
  // 仙人掌顶花 (z=4)
  b.put(1, 1, 4, 'basic', C_FLOWER)
  return b.build('plant', '桌上仙人掌', 1, 1)
}

/** 街角咖啡（原木托盘 + 暖白骨瓷杯 + 浓缩咖啡与奶沫，约 21 块 / 4 层） */
export function makeCoffeeBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_SAUCER = '#a89f91' // 原木/亚麻灰碟
  const C_CUP = '#f1f5f9' // 暖白骨瓷
  const C_COFFEE = '#4a2c1d' // 浓缩深褐
  const C_FOAM = '#c69c6d' // 焦糖拉花

  // 碟盘底座 3×3
  b.fill(0, 2, 0, 2, 0, 0, 'basic', C_SAUCER)
  // 杯身下段 2×2 + 杯把
  b.fill(0, 1, 0, 1, 1, 1, 'basic', C_CUP)
  b.put(2, 0, 1, 'basic', C_CUP)
  // 杯身上段 2×2 + 杯把
  b.fill(0, 1, 0, 1, 2, 2, 'basic', C_CUP)
  b.put(2, 0, 2, 'basic', C_CUP)
  // 咖啡拉花 / 热气
  b.put(0, 0, 3, 'basic', C_COFFEE)
  b.put(1, 1, 3, 'basic', C_FOAM)
  return b.build('coffee', '街角咖啡', 1, 1)
}

/** 复古双反相机：金属边框 + 黑色皮革机体 + 双镜头 + 顶部折叠屏与黄铜转盘（53 块 / 5 层） */
export function makeCameraBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BODY = '#2b2a29' // 黑色皮革
  const C_FRAME = '#cbd5e1' // 钛灰金属
  const C_LENS = '#0284c7' // 镀膜镜头蓝
  const C_DIAL = '#f59e0b' // 黄铜拨盘
  const C_RED = '#ef4444' // 经典红标

  // 机身底座 4×3 (z=0)
  b.fill(0, 3, 0, 2, 0, 0, 'basic', C_FRAME)
  // 机身主体下段 4×3 (z=1) + 下主镜头
  b.fill(0, 3, 0, 2, 1, 1, 'basic', C_BODY)
  b.put(1, 2, 1, 'basic', C_LENS)
  b.put(2, 2, 1, 'basic', C_LENS)
  // 机身主体中段 4×3 (z=2) + 上取景镜头 + 侧边调焦转盘
  b.fill(0, 3, 0, 2, 2, 2, 'basic', C_BODY)
  b.put(1, 2, 2, 'basic', C_LENS)
  b.put(2, 2, 2, 'basic', C_LENS)
  b.put(3, 1, 2, 'basic', C_DIAL)
  // 机顶金属盖板 4×3 (z=3) + 经典红标
  b.fill(0, 3, 0, 2, 3, 3, 'basic', C_FRAME)
  b.put(0, 2, 3, 'basic', C_RED)
  // 顶部取景器折叠屏 2×2 (z=4) + 快门按钮
  b.fill(1, 2, 0, 1, 4, 4, 'basic', C_BODY)
  b.put(0, 1, 4, 'basic', C_DIAL)
  return b.build('camera', '复古相机', 1, 1)
}

/** 荷兰风车磨坊：石砌基座 + 原木塔身 + 红陶斜屋顶 + 稳固四翼风翼（82 块 / 8 层） */
export function makeWindmillBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_STONE = '#94a3b8' // 石砌底座
  const C_WOOD = '#854d0e' // 原木板壁
  const C_ROOF = '#b4533c' // 红陶瓦斜顶
  const C_SAIL = '#f8fafc' // 白帆风叶
  const C_HUB = '#1e293b' // 轴心黑

  // 石砌基盘 5×5 (z=0, 1)
  b.fill(0, 4, 0, 4, 0, 0, 'basic', C_STONE)
  b.fill(0, 4, 0, 4, 1, 1, 'basic', C_STONE)
  b.put(2, 4, 1, 'gate', C_STONE)
  // 塔身下段 3×3 (z=2, 3)
  b.fill(1, 3, 1, 3, 2, 2, 'basic', C_WOOD)
  b.fill(1, 3, 1, 3, 3, 3, 'basic', C_WOOD)
  b.put(2, 3, 3, 'window', C_WOOD)
  // 塔身上段 3×3 (z=4)
  b.fill(1, 3, 1, 3, 4, 4, 'basic', C_WOOD)
  b.put(2, 3, 4, 'basic', C_HUB) // 轴心座
  // 塔顶斜檐 3×3 (z=5) + 四方风翼十字
  b.fill(1, 3, 1, 3, 5, 5, 'basic', C_ROOF)
  b.put(2, 3, 5, 'basic', C_SAIL) // 上翼根部
  b.put(1, 3, 5, 'basic', C_SAIL) // 左翼
  b.put(3, 3, 5, 'basic', C_SAIL) // 右翼
  // 顶冠 2×2 (z=6)
  b.fill(1, 2, 1, 2, 6, 6, 'basic', C_ROOF)
  b.put(2, 2, 6, 'basic', C_SAIL) // 上翼梢
  // 避雷顶针 (z=7)
  b.put(1, 1, 7, 'basic', C_ROOF)
  return b.build('windmill', '风车磨坊', 2, 2)
}

/** 林间木屋：户外露台 + 原木圆木墙身 + 砌石壁炉烟囱 + 坡屋顶（108 块 / 6 层） */
export function makeCabinBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_DECK = '#a89f91' // 露台甲板
  const C_LOG = '#78350f' // 深红杉圆木
  const C_ROOF = '#334155' // 高山板岩黑瓦
  const C_STONE = '#64748b' // 石砌烟囱
  const C_WARM = '#d97706' // 暖黄窗灯

  // 户外露台与地台 6×5 (z=0)
  b.fill(0, 5, 0, 4, 0, 0, 'basic', C_DECK)
  // 木屋底层 5×4 (z=1) + 烟囱位置 (4, 3)
  b.fill(0, 4, 0, 3, 1, 1, 'basic', C_LOG)
  b.put(4, 3, 1, 'basic', C_STONE)
  b.put(2, 3, 1, 'gate', C_LOG)
  // 木屋中层 5×4 (z=2) + 窗户
  b.fill(0, 4, 0, 3, 2, 2, 'basic', C_LOG)
  b.put(4, 3, 2, 'basic', C_STONE)
  b.put(1, 3, 2, 'window', C_WARM)
  b.put(3, 3, 2, 'window', C_WARM)
  // 木屋上层 5×4 (z=3)
  b.fill(0, 4, 0, 3, 3, 3, 'basic', C_LOG)
  b.put(4, 3, 3, 'basic', C_STONE)
  // 人字坡斜屋顶下段 4×4 (z=4)
  b.fill(0, 3, 0, 3, 4, 4, 'basic', C_ROOF)
  b.put(4, 3, 4, 'basic', C_STONE)
  // 屋脊顶线 2×4 (z=5) + 烟囱出风口
  b.fill(1, 2, 0, 3, 5, 5, 'basic', C_ROOF)
  b.put(4, 3, 5, 'basic', C_STONE)
  return b.build('cabin', '林间木屋', 2, 2)
}

/** 复古火箭：四片稳定翼 + 航天白箭体 + 舷窗 + 经典红鼻锥（107 块 / 12 层） */
export function makeRocketBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_WHITE = '#f8fafc' // 航天陶瓷白
  const C_RED = '#e11d48' // 经典红色翼板与鼻锥
  const C_BLUE = '#0284c7' // 舷窗深空蓝
  const C_METAL = '#475569' // 钛灰火箭发动机
  const C_FLAME = '#f59e0b' // 发射台基座焰色

  // 发射台尾焰基座 5×5 (z=0)
  b.fill(0, 4, 0, 4, 0, 0, 'basic', C_FLAME)
  // 4 枚红舵翼与发动机喷口 (z=1, 2)
  b.fill(1, 3, 1, 3, 1, 2, 'basic', C_METAL)
  b.put(0, 2, 1, 'basic', C_RED); b.put(4, 2, 1, 'basic', C_RED)
  b.put(2, 0, 1, 'basic', C_RED); b.put(2, 4, 1, 'basic', C_RED)
  b.put(0, 2, 2, 'basic', C_RED); b.put(4, 2, 2, 'basic', C_RED)
  b.put(2, 0, 2, 'basic', C_RED); b.put(2, 4, 2, 'basic', C_RED)
  // 圆柱箭体下段 3×3 (z=3, 4)
  b.fill(1, 3, 1, 3, 3, 3, 'basic', C_WHITE)
  b.fill(1, 3, 1, 3, 4, 4, 'basic', C_WHITE)
  // 圆柱箭体中段带圆形观测舷窗 3×3 (z=5, 6)
  b.fill(1, 3, 1, 3, 5, 5, 'basic', C_WHITE)
  b.put(2, 3, 5, 'window', C_BLUE)
  b.fill(1, 3, 1, 3, 6, 6, 'basic', C_WHITE)
  b.put(2, 3, 6, 'window', C_BLUE)
  // 圆柱箭体上段 3×3 (z=7)
  b.fill(1, 3, 1, 3, 7, 7, 'basic', C_WHITE)
  // 红色收窄过渡段 2×2 (z=8, 9)
  b.fill(1, 2, 1, 2, 8, 9, 'basic', C_RED)
  // 红色流线圆锥头 (z=10)
  b.put(1, 1, 10, 'basic', C_RED)
  b.put(2, 2, 10, 'basic', C_RED)
  // 鼻锥天线针 (z=11)
  b.put(1, 1, 11, 'basic', C_RED)
  return b.build('rocket', '复古火箭', 2, 2)
}
