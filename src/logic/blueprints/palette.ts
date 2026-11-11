/**
 * 蓝图色彩系统（D-20261111-067）。
 *
 * 只允许这里列出的材质色：全部来自仓库既有色板，不新增色相。
 * 每座模型的角色 → 色值在 BLUEPRINT_COLOR_PLAN 中声明，palette.test 会验证
 * 「声明的每个颜色都实际出现在该模型里」+「每座至少 3 色」+「彩色比例下限」。
 */

/** 材质家族：一份颜色只属于一个家族，避免语义漂移 */
export const MATERIAL_FAMILIES = {
  stone: ['#94a3b8', '#64748b', '#475569', '#334155'],
  light: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#a89f91'],
  earth: ['#78350f', '#854d0e', '#b4533c', '#9c432f', '#c69c6d', '#4a2c1d'],
  warm: ['#f59e0b', '#e9c46a', '#d97706'],
  // #2b2a29：复古相机黑色皮革（仓库既有 hex，中性黑，与 #1e293b 同属深墨族；
  // D-067 调色板表补录此值，避免「保留既有材质色」与「全部色值须在批准色板」冲突）
  cool: ['#0284c7', '#1e293b', '#2b2a29'],
  life: ['#4f776a'],
  signal: ['#e11d48', '#ef4444'],
} as const

export type MaterialFamily = keyof typeof MATERIAL_FAMILIES

/** 批准的全部蓝图色值 */
export const APPROVED_BLUEPRINT_COLORS: ReadonlySet<string> = new Set(
  Object.values(MATERIAL_FAMILIES).flat(),
)

/** 中性材质家族（石/浅色）；其余家族视为「强调色/识别色」 */
export const NEUTRAL_FAMILIES: ReadonlySet<MaterialFamily> = new Set(['stone', 'light'])

/** 该色是否属于非中性强调色（earth/warm/cool/life/signal） */
export function isAccentColor(color: string): boolean {
  const family = familyOf(color)
  return family !== null && !NEUTRAL_FAMILIES.has(family)
}

export function familyOf(color: string): MaterialFamily | null {
  for (const [family, colors] of Object.entries(MATERIAL_FAMILIES)) {
    if ((colors as readonly string[]).includes(color)) return family as MaterialFamily
  }
  return null
}

export interface BlueprintColorPlan {
  /** 角色 → 色值；测试会验证每个色值都在该蓝图里出现 */
  roles: Record<string, string>
  /** 带 color 字段的块比例下限（默认 15%） */
  minRatio?: number
  /** 非中性强调色占比下限（默认 8%）；识别色（earth/warm/cool/life/signal）须一眼可辨 */
  minAccentRatio?: number
}

export const BLUEPRINT_COLOR_PLAN: Record<string, BlueprintColorPlan> = {
  plant: { roles: { pot: '#b4533c', rim: '#9c432f', stem: '#4f776a', bloom: '#e9c46a' } },
  coffee: {
    roles: { saucer: '#a89f91', cup: '#f1f5f9', coffee: '#4a2c1d', foam: '#c69c6d' },
    minAccentRatio: 0.08,
  },
  camera: { roles: { body: '#2b2a29', frame: '#cbd5e1', lens: '#0284c7', dial: '#f59e0b', mark: '#ef4444' } },
  windmill: { roles: { stone: '#94a3b8', wall: '#854d0e', roof: '#b4533c', sail: '#f8fafc', hub: '#1e293b' } },
  cabin: {
    roles: { deck: '#a89f91', log: '#78350f', roof: '#334155', chimney: '#64748b', light: '#d97706' },
    minAccentRatio: 0.15,
  },
  rocket: { roles: { shell: '#f8fafc', accent: '#e11d48', window: '#0284c7', metal: '#475569', flame: '#f59e0b' } },
  lighthouse: {
    roles: { base: '#64748b', tower: '#f8fafc', band: '#e11d48', lamp: '#0284c7', door: '#78350f', cap: '#334155' },
    minRatio: 0.25,
    minAccentRatio: 0.13,
  },
  factory: {
    roles: { frame: '#94a3b8', wall: '#b4533c', chimney: '#64748b', window: '#d97706', gate: '#78350f' },
    minRatio: 0.25,
    minAccentRatio: 0.45,
  },
  monument: {
    roles: { base: '#94a3b8', steps: '#cbd5e1', shaft: '#c69c6d', cap: '#f59e0b', window: '#0284c7' },
    minAccentRatio: 0.4,
  },
  pyramid: {
    roles: { tierLow: '#c69c6d', tierHigh: '#e9c46a', cap: '#f59e0b', gate: '#78350f' },
    minAccentRatio: 0.5,
  },
  robot: {
    roles: {
      foot: '#334155',
      leg: '#475569',
      body: '#94a3b8',
      arm: '#64748b',
      head: '#cbd5e1',
      eye: '#0284c7',
      antenna: '#e11d48',
      chest: '#b4533c',
    },
    minRatio: 0.3,
    minAccentRatio: 0.1,
  },
  castle: {
    roles: { wall: '#94a3b8', upper: '#64748b', roof: '#b4533c', keep: '#cbd5e1', gate: '#78350f', window: '#d97706' },
    minRatio: 0.2,
    minAccentRatio: 0.08,
  },
  treehouse: {
    roles: { bark: '#78350f', deck: '#a89f91', cabin: '#94a3b8', frame: '#475569', roof: '#334155', foliage: '#4f776a' },
    minRatio: 0.3,
    minAccentRatio: 0.15,
  },
  greenhouse: {
    roles: {
      stone: '#64748b',
      frame: '#475569',
      glass: '#cbd5e1',
      glassTop: '#e2e8f0',
      roof: '#b4533c',
      baseAccent: '#b4533c',
      planter: '#4f776a',
    },
    minRatio: 0.25,
    minAccentRatio: 0.14,
  },
  clocktower: {
    roles: { stone: '#94a3b8', body: '#64748b', trim: '#475569', roof: '#b4533c', clock: '#f59e0b', gate: '#78350f' },
    minRatio: 0.25,
    minAccentRatio: 0.12,
  },
  bridge: {
    roles: { stone: '#94a3b8', dark: '#64748b', deck: '#854d0e', rail: '#475569', lamp: '#f59e0b', keystone: '#b4533c' },
    minRatio: 0.25,
    minAccentRatio: 0.1,
  },
  observatory: {
    roles: { rock: '#64748b', rockTop: '#475569', wall: '#94a3b8', dome: '#4f776a', domeTop: '#4f776a', gate: '#78350f' },
    minRatio: 0.25,
    minAccentRatio: 0.1,
  },
  library: {
    roles: { base: '#94a3b8', wall: '#b4533c', column: '#475569', roof: '#334155', trim: '#64748b', door: '#78350f', window: '#d97706', lamp: '#f59e0b' },
    minRatio: 0.25,
  },
  // 内容包 v3（D-20261111-070）：城市与生活续章 5 座，全部复用既有批准 24 色
  bakery: {
    roles: { base: '#94a3b8', brick: '#b4533c', timber: '#78350f', plaster: '#f1f5f9', roof: '#334155', window: '#d97706', sign: '#f59e0b' },
    minAccentRatio: 0.2,
  },
  bookshop: {
    roles: {
      base: '#94a3b8',
      brick: '#b4533c',
      plaster: '#f1f5f9',
      timber: '#854d0e',
      door: '#78350f',
      roof: '#334155',
      chimney: '#64748b',
      window: '#d97706',
    },
    minAccentRatio: 0.2,
  },
  postoffice: {
    roles: { base: '#94a3b8', wall: '#e2e8f0', roof: '#334155', trim: '#b4533c', door: '#78350f', glass: '#0284c7', lamp: '#f59e0b' },
    minAccentRatio: 0.08,
  },
  firestation: {
    roles: {
      base: '#94a3b8',
      wall: '#64748b',
      roof: '#334155',
      trim: '#b4533c',
      door: '#78350f',
      window: '#d97706',
      signal: '#e11d48',
    },
    minAccentRatio: 0.08,
  },
  watertower: {
    roles: {
      base: '#94a3b8',
      leg: '#475569',
      brace: '#78350f',
      deck: '#64748b',
      tank: '#cbd5e1',
      roof: '#334155',
      glass: '#0284c7',
      lamp: '#f59e0b',
    },
    minAccentRatio: 0.08,
  },
}
