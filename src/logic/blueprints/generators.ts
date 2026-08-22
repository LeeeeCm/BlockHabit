import type { BlockDef, BlockType, Blueprint } from '../../types'

/**
 * 蓝图生成器：用 Map 去重，按"自下而上、由内向外"排序，
 * 数组顺序即拼建顺序（每次打卡取下一块）。
 */

function key(x: number, y: number, z: number): string {
  return `${x},${y},${z}`
}

export function createBlueprintBuilder() {
  const map = new Map<string, BlockDef>()

  function put(x: number, y: number, z: number, type: BlockType = 'basic') {
    map.set(key(x, y, z), { x, y, z, type })
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
  ) {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) map.set(key(x, y, z), { x, y, z, type })
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

/** 城堡：9×9，周边城墙 + 四角塔 + 中央主楼，旗帜/窗/大门点缀 */
export function makeCastleBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  // 城墙（周边一圈，高 2）
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
  // 正面大门
  b.put(4, 8, 0, 'gate')
  b.put(4, 8, 1, 'gate')
  // 城墙窗
  b.put(2, 8, 1, 'window')
  b.put(6, 8, 1, 'window')
  b.put(2, 0, 1, 'window')
  b.put(6, 0, 1, 'window')
  // 四角 2×2 塔，高 5
  for (const [tx, ty] of [
    [0, 0],
    [7, 0],
    [0, 7],
    [7, 7],
  ] as const) {
    b.fill(tx, tx + 1, ty, ty + 1, 0, 4)
  }
  // 塔顶旗帜
  b.put(0, 0, 5, 'flag')
  b.put(8, 0, 5, 'flag')
  b.put(0, 8, 5, 'flag')
  b.put(8, 8, 5, 'flag')
  // 中央主楼 3×3，高 4
  b.fill(3, 5, 3, 5, 0, 3)
  b.put(3, 4, 2, 'window')
  b.put(5, 4, 2, 'window')
  b.put(4, 3, 2, 'window')
  b.put(4, 5, 2, 'window')
  b.put(4, 4, 4, 'flag')
  return b.build('castle', '灰岩城堡', 4, 4)
}

/** 工厂：11×7，厂房主体 + 双烟囱 + 天窗 */
export function makeFactoryBlueprint(): Blueprint {
  const b = createBlueprintBuilder()
  // 围墙
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
  // 大门
  b.put(5, 6, 0, 'gate')
  b.put(5, 6, 1, 'gate')
  // 厂房主体 7×5，高 3
  b.fill(2, 8, 1, 5, 0, 2)
  // 天窗
  b.put(3, 3, 2, 'window')
  b.put(5, 3, 2, 'window')
  b.put(7, 3, 2, 'window')
  // 双烟囱（立于厂房顶）
  b.put(3, 2, 3)
  b.put(3, 2, 4, 'chimney')
  b.put(7, 2, 3)
  b.put(7, 2, 4, 'chimney')
  return b.build('factory', '黑白工厂', 5, 3)
}
