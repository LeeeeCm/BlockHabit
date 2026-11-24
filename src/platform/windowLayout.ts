/**
 * 设备本地窗口位置（D-20261124-088：摆件三档已删除，只保留主窗与桌宠）。
 *
 * 只存设备本地 localStorage，不进存档、不参与同步；显示器被拔掉时由调用方换 primaryMonitor。
 */

export interface LogicalPoint {
  x: number
  y: number
}

export interface WindowLayoutV1 {
  version: 1
  main?: { w: number; h: number; x?: number; y?: number }
  pet?: LogicalPoint
  /** @deprecated 旧迷你摆件位置；仅用于一次性迁移到 pet */
  mini?: LogicalPoint
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
    const pet = p.pet as Record<string, unknown> | undefined
    if (pet && isFiniteNumber(pet.x) && isFiniteNumber(pet.y)) {
      layout.pet = { x: pet.x, y: pet.y }
    }
    const mini = p.mini as Record<string, unknown> | undefined
    if (mini && isFiniteNumber(mini.x) && isFiniteNumber(mini.y)) {
      layout.mini = { x: mini.x, y: mini.y }
      if (!layout.pet) layout.pet = layout.mini
    }
    return layout
  } catch {
    return { ...EMPTY_LAYOUT }
  }
}

export function saveWindowLayout(layout: WindowLayoutV1): void {
  try {
    localStorage.setItem(WINDOW_LAYOUT_KEY, JSON.stringify({ ...layout, version: 1 }))
  } catch {
    // 隐私模式/禁用 localStorage：位置只影响本次会话，不阻断桌宠
  }
}

export function loadPetPosition(): LogicalPoint | null {
  return loadWindowLayout().pet ?? null
}

export function savePetPosition(pet: LogicalPoint): void {
  saveWindowLayout({ ...loadWindowLayout(), pet })
}
