/**
 * 迷你摆件三档尺寸与窗口位置（D-20261110-059）。
 *
 * 纯数据 + 纯函数：App 里的窗口副作用（setSize/setPosition/currentMonitor）
 * 只做「读取 → 调这些函数 → 调 Tauri API」，方便单测覆盖 DPI/多屏边界。
 */

export type MiniSize = 'pocket' | 'standard' | 'display'

export interface MiniPreset {
  /** 逻辑像素（Tauri setSize 是 inner size） */
  w: number
  h: number
  headerH: number
  footerH: number
  /** 3D 区最小可用高度（开发期断言用） */
  stageMinH: number
  maxPills: number
  showProgressText: boolean
  showTodayList: boolean
}

export const MINI_SIZE_ORDER: MiniSize[] = ['pocket', 'standard', 'display']

export const MINI_PRESETS: Record<MiniSize, MiniPreset> = {
  // footer 含 32px 命中区（D-059 验收：胶囊/清单行 ≥32px），预算按真实内容高度修正
  pocket: {
    w: 220,
    h: 150,
    headerH: 34,
    footerH: 72,
    stageMinH: 36,
    maxPills: 1,
    showProgressText: false,
    showTodayList: false
  },
  standard: {
    w: 280,
    h: 400,
    headerH: 34,
    footerH: 124,
    stageMinH: 180,
    maxPills: 3,
    showProgressText: true,
    showTodayList: false
  },
  display: {
    w: 420,
    h: 560,
    headerH: 36,
    footerH: 170,
    stageMinH: 260,
    maxPills: 5,
    showProgressText: true,
    showTodayList: true
  }
}

export interface LogicalRect {
  x: number
  y: number
  width: number
  height: number
}

export interface LogicalPoint {
  x: number
  y: number
}

/** 逻辑尺寸不变式：三块加起来必须放得进窗口（留 8px 呼吸） */
export function presetFits(preset: MiniPreset): boolean {
  return preset.headerH + preset.stageMinH + preset.footerH <= preset.h - 8
}

/** 窗口右下角默认位置（逻辑像素） */
export function defaultMiniPosition(
  workArea: LogicalRect,
  preset: MiniPreset,
  margin = 16
): LogicalPoint {
  return {
    x: Math.round(workArea.x + workArea.width - preset.w - margin),
    y: Math.round(workArea.y + workArea.height - preset.h - margin)
  }
}

/** 把位置钳制进当前显示器工作区（含任务栏）；显示器被拔掉时调用方负责换 primaryMonitor */
export function clampMiniPosition(
  pos: LogicalPoint,
  workArea: LogicalRect,
  preset: MiniPreset,
  margin = 8
): LogicalPoint {
  const minX = workArea.x + margin
  const minY = workArea.y + margin
  const maxX = workArea.x + workArea.width - preset.w - margin
  const maxY = workArea.y + workArea.height - preset.h - margin
  return {
    x: Math.round(Math.min(Math.max(pos.x, minX), Math.max(minX, maxX))),
    y: Math.round(Math.min(Math.max(pos.y, minY), Math.max(minY, maxY)))
  }
}

export interface WindowLayoutV1 {
  version: 1
  main?: { w: number; h: number; x?: number; y?: number }
  mini?: { x: number; y: number }
}

export const WINDOW_LAYOUT_KEY = 'blockhabit.windowLayout.v1'

const EMPTY_LAYOUT: WindowLayoutV1 = { version: 1 }

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export function loadWindowLayout(): WindowLayoutV1 {
  try {
    const raw = localStorage.getItem(WINDOW_LAYOUT_KEY)
    if (!raw) return { ...EMPTY_LAYOUT }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY_LAYOUT }
    const p = parsed as Record<string, unknown>
    const layout: WindowLayoutV1 = { version: 1 }
    const main = p.main as Record<string, unknown> | undefined
    if (main && isFiniteNumber(main.w) && isFiniteNumber(main.h)) {
      layout.main = { w: main.w, h: main.h }
      if (isFiniteNumber(main.x) && isFiniteNumber(main.y)) {
        layout.main.x = main.x
        layout.main.y = main.y
      }
    }
    const mini = p.mini as Record<string, unknown> | undefined
    if (mini && isFiniteNumber(mini.x) && isFiniteNumber(mini.y))
      layout.mini = { x: mini.x, y: mini.y }
    return layout
  } catch {
    return { ...EMPTY_LAYOUT }
  }
}

export function saveWindowLayout(layout: WindowLayoutV1): void {
  try {
    localStorage.setItem(WINDOW_LAYOUT_KEY, JSON.stringify({ ...layout, version: 1 }))
  } catch {
    // 隐私模式/禁用 localStorage：位置只影响本次会话，不阻断摆件
  }
}
