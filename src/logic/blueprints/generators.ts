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

  function build(id: string, cx: number, cy: number): Blueprint {
    const blocks = [...map.values()].sort((a, b) => {
      if (a.z !== b.z) return a.z - b.z
      const da = Math.abs(a.x - cx) + Math.abs(a.y - cy)
      const db = Math.abs(b.x - cx) + Math.abs(b.y - cy)
      if (da !== db) return da - db
      if (a.x !== b.x) return a.x - b.x
      return a.y - b.y
    })
    return { id, blocks }
  }

  return { put, fill, build }
}

/** 灰岩城堡 v2：垛口城墙 + 高低塔楼 + 拱门（190 块 / 7 层） */
export function makeCastleBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_WALL = '#94a3b8' // 灰岩石墙
  const C_UPPER = '#64748b' // 垛口/上沿深灰
  const C_ROOF = '#b4533c' // 塔顶红陶瓦
  const C_KEEP = '#cbd5e1' // 中央主楼浅石
  const C_GATE = '#78350f' // 木门
  const C_WARM = '#d97706' // 暖窗
  // 外墙两圈高（9×9 周边）
  for (let i = 0; i <= 8; i++) {
    for (const [x, y] of [
      [i, 0],
      [i, 8],
      [0, i],
      [8, i],
    ] as const) {
      b.put(x, y, 0, 'basic', C_WALL)
      b.put(x, y, 1, 'basic', C_WALL)
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
      if ((x + y) % 2 === 0) b.put(x, y, 2, 'basic', C_UPPER)
    }
  }
  // 四角 2×2 高塔（6 层）+ 外角封顶
  for (const [tx, ty] of [
    [0, 0],
    [7, 0],
    [0, 7],
    [7, 7],
  ] as const) {
    b.fill(tx, tx + 1, ty, ty + 1, 0, 1, 'basic', C_WALL)
    b.fill(tx, tx + 1, ty, ty + 1, 2, 5, 'basic', C_UPPER)
    b.put(tx === 0 ? 0 : 8, ty === 0 ? 0 : 8, 6, 'basic', C_ROOF)
  }
  // 中央主楼 3×3×4 + 顶上收细两块
  b.fill(3, 5, 3, 5, 0, 3, 'basic', C_KEEP)
  b.put(4, 4, 4, 'basic', C_KEEP)
  b.put(4, 4, 5, 'basic', C_KEEP)
  // 大门 + 门楼窗
  b.put(4, 8, 0, 'gate', C_GATE)
  b.put(4, 8, 1, 'gate', C_GATE)
  // 窗：主楼四面 + 城墙（暖光）
  b.put(3, 4, 2, 'window', C_WARM)
  b.put(5, 4, 2, 'window', C_WARM)
  b.put(4, 3, 2, 'window', C_WARM)
  b.put(4, 5, 2, 'window', C_WARM)
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
    b.put(x, y, 1, 'window', C_WARM)
  }
  return b.build('castle', 4, 4)
}

/** 黑白工厂 v2：厂房 + 真积木方柱烟囱（约 175 块） */
export function makeFactoryBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_FRAME = '#94a3b8' // 外框金属灰
  const C_WALL = '#b4533c' // 红砖厂房
  const C_CHIMNEY = '#64748b' // 石砌烟囱
  const C_WARM = '#d97706' // 暖窗
  const C_GATE = '#78350f' // 木门
  for (let x = 0; x <= 10; x++) {
    b.put(x, 0, 0, 'basic', C_FRAME)
    b.put(x, 0, 1, 'basic', C_FRAME)
    b.put(x, 6, 0, 'basic', C_FRAME)
    b.put(x, 6, 1, 'basic', C_FRAME)
  }
  for (let y = 1; y <= 5; y++) {
    b.put(0, y, 0, 'basic', C_FRAME)
    b.put(0, y, 1, 'basic', C_FRAME)
    b.put(10, y, 0, 'basic', C_FRAME)
    b.put(10, y, 1, 'basic', C_FRAME)
  }
  b.put(5, 6, 0, 'gate', C_GATE)
  b.put(5, 6, 1, 'gate', C_GATE)
  // 厂房主体 7×5 高 3（红砖）
  b.fill(2, 8, 1, 5, 0, 2, 'basic', C_WALL)
  // 天窗（暖光）
  b.put(3, 3, 2, 'window', C_WARM)
  b.put(5, 3, 2, 'window', C_WARM)
  b.put(7, 3, 2, 'window', C_WARM)
  // 双烟囱：立于厂房顶的 1×1 积木方柱（石砌灰）
  b.fill(3, 3, 2, 2, 3, 5, 'basic', C_CHIMNEY)
  b.fill(7, 7, 2, 2, 3, 5, 'basic', C_CHIMNEY)
  return b.build('factory', 5, 3)
}

/** 灯塔：宽底座 + 高塔 + 顶灯（131 块 / 11 层） */
export function makeLighthouseBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#64748b' // 石砌基座
  const C_TOWER = '#f8fafc' // 白塔身
  const C_BAND = '#e11d48' // 红色航标条纹
  const C_LAMP = '#0284c7' // 蓝玻璃灯室
  const C_DOOR = '#78350f' // 木门
  const C_CAP = '#334155' // 深灰塔顶
  // 底座 5×5 高 3（石砌）+ 木门
  b.fill(0, 4, 0, 4, 0, 2, 'basic', C_BASE)
  b.put(2, 4, 2, 'basic', C_DOOR)
  // 塔 3×3 高 5（白塔身，z5 一圈红色航标条纹）
  b.fill(1, 3, 1, 3, 3, 7, 'basic', C_TOWER)
  b.fill(1, 3, 1, 3, 5, 5, 'basic', C_BAND)
  // 顶灯（蓝玻璃）+ 塔尖
  b.put(2, 2, 7, 'window', C_LAMP)
  b.fill(1, 3, 1, 3, 8, 8, 'basic', C_LAMP)
  b.put(1, 1, 8, 'window', C_LAMP)
  b.put(3, 3, 8, 'window', C_LAMP)
  b.put(2, 2, 9, 'basic', C_CAP)
  b.put(2, 2, 10, 'basic', C_CAP)
  // 塔身竖排窗
  b.put(1, 2, 4, 'window', C_TOWER)
  b.put(1, 2, 6, 'window', C_TOWER)
  b.put(3, 2, 5, 'window', C_TOWER)
  return b.build('lighthouse', 2, 2)
}

/** 金字塔：9→7→5→3→1 实心阶梯（约 165 块 / 5 层） */
export function makePyramidBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_LOW = '#c69c6d' // 下层沙岩
  const C_HIGH = '#e9c46a' // 上层受光沙岩
  const C_CAP = '#f59e0b' // 塔尖黄铜
  const C_GATE = '#78350f' // 木门洞
  b.fill(0, 8, 0, 8, 0, 0, 'basic', C_LOW)
  b.fill(1, 7, 1, 7, 1, 1, 'basic', C_LOW)
  b.fill(2, 6, 2, 6, 2, 2, 'basic', C_HIGH)
  b.fill(3, 5, 3, 5, 3, 3, 'basic', C_HIGH)
  b.put(4, 4, 4, 'basic', C_CAP)
  // 正面门洞
  b.put(4, 8, 0, 'gate', C_GATE)
  return b.build('pyramid', 4, 4)
}

/** 守护机器人 v2：脚掌 + 腿 + 骨盆柱 + 宽躯干 + 单节手臂 + 方头 + 天线（165 块 / 12 层）
 * 正面 = y 最大侧（与城堡 gate 面一致）。躯干 5×3 全部列由“双腿（深 3）+ 中央骨盆柱”垂直支撑，无悬空。 */
export function makeRobotBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_FOOT = '#334155' // 深灰脚掌
  const C_LEG = '#475569' // 金属腿/骨盆
  const C_BODY = '#94a3b8' // 灰钢躯干
  const C_ARM = '#64748b' // 深灰手臂
  const C_HEAD = '#cbd5e1' // 浅灰头盔
  const C_EYE = '#0284c7' // 蓝光眼/传感器
  const C_ANTENNA = '#e11d48' // 红色天线
  const C_CHEST = '#b4533c' // 红陶胸甲（识别色强化）
  // 脚掌 2×3 ×2（z0）+ 中央骨盆基座（3 块，支撑骨盆柱）
  b.fill(1, 2, 0, 2, 0, 0, 'basic', C_FOOT)
  b.fill(4, 5, 0, 2, 0, 0, 'basic', C_FOOT)
  b.fill(3, 3, 0, 2, 0, 0, 'basic', C_FOOT)
  // 腿部 2×3×3 ×2（z1-3，深度与脚掌/躯干对齐，承托躯干两侧 12 列）
  b.fill(1, 2, 0, 2, 1, 3, 'basic', C_LEG)
  b.fill(4, 5, 0, 2, 1, 3, 'basic', C_LEG)
  // 中央 1×3 骨盆柱（z1-3，支撑躯干中段 3 列）
  b.fill(3, 3, 0, 2, 1, 3, 'basic', C_LEG)
  // 躯干 5×3×4（z4-7）
  b.fill(1, 5, 0, 2, 4, 7, 'basic', C_BODY)
  // 正面胸甲 5×1×3（z5-7，复用躯干坐标，不改块数）
  b.fill(1, 5, 2, 2, 5, 7, 'basic', C_CHEST)
  // 手臂 1×1 立柱 ×2（z0-6，躯干外侧紧邻）
  b.fill(0, 0, 1, 1, 0, 6, 'basic', C_ARM)
  b.fill(6, 6, 1, 1, 0, 6, 'basic', C_ARM)
  // 肩块 2（z7，坐手臂柱顶并与躯干顶缘相接）
  b.put(0, 1, 7, 'basic', C_ARM)
  b.put(6, 1, 7, 'basic', C_ARM)
  // 头 3×3×3（z8-10）
  b.fill(2, 4, 0, 2, 8, 10, 'basic', C_HEAD)
  // 眼睛：正面中层（z9）2 个 window
  b.put(2, 2, 9, 'window', C_EYE)
  b.put(4, 2, 9, 'window', C_EYE)
  // 胸前传感器：正面 z6 2 个 window
  b.put(2, 2, 6, 'window', C_EYE)
  b.put(4, 2, 6, 'window', C_EYE)
  // 天线 2（z11，头顶）
  b.put(2, 1, 11, 'basic', C_ANTENNA)
  b.put(4, 1, 11, 'basic', C_ANTENNA)
  return b.build('robot', 3, 1)
}

/** 纪念碑：基座 + 台阶 + 碑身 + 封顶（约 147 块 / 11 层） */
export function makeMonumentBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#94a3b8' // 石砌基座
  const C_STEPS = '#cbd5e1' // 浅石台阶
  const C_SHAFT = '#c69c6d' // 沙岩碑身
  const C_CAP = '#f59e0b' // 黄铜封顶
  const C_WINDOW = '#0284c7' // 蓝玻璃碑窗
  b.fill(0, 6, 0, 6, 0, 0, 'basic', C_BASE) // 基座 7×7
  b.fill(1, 5, 1, 5, 1, 1, 'basic', C_STEPS) // 台阶 5×5
  b.fill(2, 4, 2, 4, 2, 8, 'basic', C_SHAFT) // 碑身 3×3×7
  b.fill(2, 4, 2, 4, 9, 9, 'basic', C_CAP) // 顶盘 3×3
  b.put(3, 3, 10, 'basic', C_CAP) // 封顶
  // 正面竖列窗
  b.put(3, 4, 3, 'window', C_WINDOW)
  b.put(3, 4, 5, 'window', C_WINDOW)
  b.put(3, 4, 7, 'window', C_WINDOW)
  return b.build('monument', 3, 3)
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
  return b.build('plant', 1, 1)
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
  return b.build('coffee', 1, 1)
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
  return b.build('camera', 1, 1)
}

/** 荷兰风车磨坊：石砌基座 + 原木塔身 + 红陶斜屋顶 + 稳固四翼风翼（91 块 / 8 层） */
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
  return b.build('windmill', 2, 2)
}

/** 林间木屋：户外露台 + 原木圆木墙身 + 砌石壁炉烟囱 + 坡屋顶（116 块 / 6 层） */
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
  return b.build('cabin', 2, 2)
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
  return b.build('rocket', 2, 2)
}

/** 林间树屋：三阶树桩 + 环绕露台 + 方木小屋 + 坡屋顶（119 块 / 10 层）
 * 正面 = y 最大侧；露台由中央树桩支撑，其余同层相接（允许 1 格悬挑，不产生完全悬空块）。 */
export function makeTreehouseBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BARK = '#78350f' // 深红杉树皮（沿用林间木屋）
  const C_DECK = '#a89f91' // 亚麻灰露台
  const C_CABIN = '#94a3b8' // 灰蓝板壁
  const C_FRAME = '#475569' // 深灰框架
  const C_ROOF = '#334155' // 板岩屋顶
  const C_FOLIAGE = '#4f776a' // 鼠尾草树冠

  // 树桩基座 3×3 与主干（z0-3）
  b.fill(3, 5, 3, 5, 0, 0, 'basic', C_BARK)
  b.fill(4, 4, 4, 4, 1, 3, 'basic', C_BARK)
  // 两根横向枝干（与主干同层相连）
  b.put(3, 4, 2, 'basic', C_BARK)
  b.put(5, 4, 2, 'basic', C_BARK)
  // 环绕露台 7×7（z4）
  b.fill(1, 7, 1, 7, 4, 4, 'basic', C_DECK)
  // 露台四角花池（D-067 强化：树冠延伸，复用坐标）
  for (const [x, y] of [
    [1, 1],
    [7, 1],
    [1, 7],
    [7, 7],
  ] as const) {
    b.put(x, y, 4, 'basic', C_FOLIAGE)
  }
  // 方木小屋 4×4 ×2 层（z5-6）+ 门与窗
  b.fill(2, 5, 2, 5, 5, 6, 'basic', C_CABIN)
  b.put(3, 5, 5, 'gate', C_CABIN)
  b.put(2, 5, 5, 'window', C_CABIN)
  b.put(5, 5, 6, 'window', C_CABIN)
  b.put(2, 2, 6, 'window', C_CABIN)
  // 坡屋顶两层（z7-8）
  b.fill(2, 5, 2, 5, 7, 7, 'basic', C_ROOF)
  b.fill(3, 4, 3, 4, 8, 8, 'basic', C_FRAME)
  // 树冠 4 块（D-067：屋顶两肩之上，落在屋脊块上，不悬空）
  b.fill(3, 4, 3, 4, 9, 9, 'basic', C_FOLIAGE)
  return b.build('treehouse', 4, 4)
}

/** 玻璃温室：石砌矮基 + 玻璃方体 + 平坡玻璃顶（83 块 / 5 层）
 * 灰阶玻璃用两级浅灰表达透光，装饰只有 1 门 2 窗。 */
export function makeGreenhouseBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_STONE = '#64748b' // 石砌基座
  const C_FRAME = '#475569' // 深灰框架
  const C_GLASS = '#cbd5e1' // 玻璃浅灰
  const C_GLASS_TOP = '#e2e8f0' // 受光玻璃更浅
  const C_ROOF = '#b4533c' // 红陶顶脊（识别色强化）
  const C_PLANTER = '#4f776a' // 鼠尾草绿植槽
  const C_BASE_ACCENT = '#b4533c' // 基座前沿红陶（识别色强化）

  // 石砌矮基 7×5（z0）
  b.fill(0, 6, 0, 4, 0, 0, 'basic', C_STONE)
  // 基座前沿 y=4 一排红陶砖（识别色，复用坐标）
  for (let x = 0; x <= 6; x++) b.put(x, 4, 0, 'basic', C_BASE_ACCENT)
  // 玻璃主体 5×3 ×2 层（z1-2）
  b.fill(1, 5, 1, 3, 1, 2, 'basic', C_GLASS)
  // 四角框架柱（覆盖玻璃同坐标）
  for (const [x, y] of [
    [1, 1],
    [5, 1],
    [1, 3],
    [5, 3],
  ] as const) {
    b.put(x, y, 1, 'basic', C_FRAME)
    b.put(x, y, 2, 'basic', C_FRAME)
  }
  // 入口与透气窗
  b.put(3, 3, 1, 'gate', C_FRAME)
  b.put(2, 3, 1, 'window', C_GLASS)
  b.put(4, 3, 2, 'window', C_GLASS)
  // 四块正面玻璃改为植物绿（D-067 强化：室内种植槽，坐标不变）
  b.put(4, 3, 1, 'basic', C_PLANTER)
  b.put(3, 3, 2, 'basic', C_PLANTER)
  b.put(2, 3, 2, 'basic', C_PLANTER)
  b.put(4, 3, 2, 'window', C_PLANTER)
  // 受光玻璃顶 5×3（z3）+ 顶脊 3×1（z4）
  b.fill(1, 5, 1, 3, 3, 3, 'basic', C_GLASS_TOP)
  b.fill(2, 4, 2, 2, 4, 4, 'basic', C_ROOF)
  return b.build('greenhouse', 3, 2)
}

/** 钟楼：石砌底座 + 方塔身 + 钟面层 + 钟亭 + 收尖屋顶（99 块 / 11 层）
 * 钟面用 1 枚 window 点缀（主题点缀色），塔身竖排小窗。 */
export function makeClocktowerBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_STONE = '#94a3b8' // 石砌底座
  const C_BODY = '#64748b' // 塔身灰石
  const C_TRIM = '#475569' // 钟面层深灰
  const C_ROOF = '#b4533c' // 红陶尖顶（识别色强化）
  const C_CLOCK = '#f59e0b' // 黄铜钟盘
  const C_GATE = '#78350f' // 木门

  // 底座 5×5（z0）+ 入口
  b.fill(0, 4, 0, 4, 0, 0, 'basic', C_STONE)
  b.put(2, 4, 0, 'gate', C_GATE)
  // 塔身 3×3 ×5 层（z1-5）+ 竖排窗
  b.fill(1, 3, 1, 3, 1, 5, 'basic', C_BODY)
  b.put(2, 3, 2, 'window', C_BODY)
  b.put(2, 3, 4, 'window', C_BODY)
  b.put(1, 1, 5, 'window', C_BODY)
  // 钟面层 3×3（z6）：两颗黄铜钟盘块 + 一个窗
  b.fill(1, 3, 1, 3, 6, 6, 'basic', C_TRIM)
  b.put(2, 3, 6, 'window', C_CLOCK)
  b.put(3, 3, 6, 'basic', C_CLOCK)
  // 钟亭 3×3（z7）+ 开口（木门色开口，读出钟亭阴影）
  b.fill(1, 3, 1, 3, 7, 7, 'basic', C_TRIM)
  b.put(2, 3, 7, 'gate', C_GATE)
  // 收分屋顶 3×3（z8）+ 塔尖两级（z9-10）
  b.fill(1, 3, 1, 3, 8, 8, 'basic', C_ROOF)
  b.put(2, 2, 9, 'basic', C_ROOF)
  b.put(2, 2, 10, 'basic', C_ROOF)
  return b.build('clocktower', 2, 2)
}

/** 石拱桥：两岸阶梯式桥台 + 悬挑拱肩 + 三格宽桥面 + 栏杆与端柱（101 块 / 6 层）
 * 桥面沿 x 方向，宽 3 格（y0-2）；拱洞靠逐层内挑形成，每块至少同层相接（无完全悬空）。 */
export function makeBridgeBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_STONE = '#94a3b8' // 桥台主石
  const C_DARK = '#64748b' // 内挑拱肩深灰
  const C_DECK = '#854d0e' // 木桥面（识别色强化）
  const C_RAIL = '#475569' // 栏杆与端柱
  const C_LAMP = '#f59e0b' // 黄铜灯柱
  const C_KEYSTONE = '#b4533c' // 陶土拱顶石

  // 两岸桥台：z0 三格宽，逐层向中心内挑（z0-3）
  b.fill(0, 2, 0, 2, 0, 0, 'basic', C_STONE)
  b.fill(8, 10, 0, 2, 0, 0, 'basic', C_STONE)
  b.fill(1, 3, 0, 2, 1, 1, 'basic', C_DARK)
  b.fill(7, 9, 0, 2, 1, 1, 'basic', C_DARK)
  b.fill(2, 4, 0, 2, 2, 2, 'basic', C_DARK)
  b.fill(6, 8, 0, 2, 2, 2, 'basic', C_DARK)
  b.fill(3, 5, 0, 2, 3, 3, 'basic', C_STONE)
  b.fill(5, 7, 0, 2, 3, 3, 'basic', C_STONE)
  // 桥面 3×3（z4）与两侧栏杆（z5）
  b.fill(4, 6, 0, 2, 4, 4, 'basic', C_DECK)
  b.fill(3, 7, 0, 0, 5, 5, 'basic', C_RAIL)
  b.fill(3, 7, 2, 2, 5, 5, 'basic', C_RAIL)
  // 四根端柱（z1-2）与柱窗
  for (const [x, y] of [
    [0, 0],
    [0, 2],
    [10, 0],
    [10, 2],
  ] as const) {
    b.put(x, y, 1, 'basic', C_RAIL)
    b.put(x, y, 2, 'basic', C_RAIL)
  }
  b.put(0, 1, 2, 'window', C_RAIL)
  b.put(10, 1, 2, 'window', C_RAIL)
  // 桥面中央门洞装饰（陶土拱顶石）
  b.put(5, 3, 4, 'gate', C_KEYSTONE)
  // 灯柱 2 块（D-067：左右端柱顶上的黄铜灯，落在端柱上不悬空）
  b.put(0, 0, 3, 'basic', C_LAMP)
  b.put(10, 2, 3, 'basic', C_LAMP)
  return b.build('bridge', 5, 1)
}

/** 山顶天文台：方形山体两级 + 灰石圆塔 + 玻璃穹顶（90 块 / 7 层）
 * 穹顶裂口用 1 枚 window 表示望远镜开口，整体灰阶、无新色相。 */
export function makeObservatoryBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_ROCK = '#64748b' // 山体下段
  const C_ROCK_TOP = '#475569' // 山体上段
  const C_WALL = '#94a3b8' // 观景塔石墙
  const C_DOME = '#4f776a' // 铜绿穹顶座（识别色强化）
  const C_PATINA = '#4f776a' // 铜绿穹顶顶
  const C_GATE = '#78350f' // 木门

  // 方形山体两级（z0-1）
  b.fill(0, 5, 0, 5, 0, 0, 'basic', C_ROCK)
  b.fill(1, 4, 1, 4, 1, 1, 'basic', C_ROCK_TOP)
  // 观景塔 3×3 ×3 层（z2-4）+ 入口与竖窗
  b.fill(2, 4, 2, 4, 2, 4, 'basic', C_WALL)
  b.put(3, 5, 2, 'gate', C_GATE)
  b.put(3, 3, 3, 'window', C_WALL)
  b.put(2, 2, 4, 'window', C_WALL)
  // 穹顶座 3×3（z5）+ 望远镜开口
  b.fill(2, 4, 2, 4, 5, 5, 'basic', C_DOME)
  b.put(3, 3, 5, 'window', C_DOME)
  // 穹顶收顶（z6，铜绿）
  b.fill(3, 3, 3, 3, 6, 6, 'basic', C_PATINA)
  return b.build('observatory', 3, 3)
}

/** 旧图书馆：石基 + 三面围合书架墙体 + 双坡屋顶 + 屋脊（108 块 / 7 层）
 * 正面 = y 最大侧；入口门与拱窗只在正/侧立面，体块整体灰阶。 */
export function makeLibraryBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  const C_BASE = '#94a3b8' // 石砌基座
  const C_WALL = '#b4533c' // 红砖墙
  const C_COLUMN = '#475569' // 深灰墙柱
  const C_ROOF = '#334155' // 板岩双坡顶
  const C_TRIM = '#64748b' // 屋脊压顶
  const C_DOOR = '#78350f' // 木门
  const C_WARM = '#d97706' // 暖窗
  const C_LAMP = '#f59e0b' // 黄铜门灯

  // 石基 6×5（z0）
  b.fill(0, 5, 0, 4, 0, 0, 'basic', C_BASE)
  // 三面围合墙体（z1-3，周长 18/层）+ 入口与高窗
  for (let z = 1; z <= 3; z++) {
    for (let x = 0; x <= 5; x++) {
      const side = x === 0 || x === 5 ? C_COLUMN : C_WALL
      b.put(x, 0, z, 'basic', side)
      b.put(x, 4, z, 'basic', side)
    }
    for (let y = 1; y <= 3; y++) {
      b.put(0, y, z, 'basic', C_COLUMN)
      b.put(5, y, z, 'basic', C_COLUMN)
    }
  }
  b.put(2, 4, 1, 'gate', C_DOOR)
  b.put(1, 4, 2, 'window', C_WARM)
  b.put(4, 4, 2, 'window', C_WARM)
  b.put(0, 2, 2, 'window', C_WARM)
  b.put(5, 2, 3, 'window', C_WARM)
  // 门灯 1 块（D-067：门侧黄铜壁灯，复用墙体坐标、不新增块）
  b.put(3, 4, 1, 'basic', C_LAMP)
  // 双坡屋顶：檐口 6×3（z4）+ 屋脊 4×1（z5）+ 压顶（z6）
  b.fill(0, 5, 1, 3, 4, 4, 'basic', C_ROOF)
  b.fill(1, 4, 2, 2, 5, 5, 'basic', C_TRIM)
  b.fill(2, 3, 2, 2, 6, 6, 'basic', C_ROOF)
  return b.build('library', 3, 2)
}
