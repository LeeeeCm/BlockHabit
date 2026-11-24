import { useCallback, useEffect, useRef, useState } from 'react'
import {
  currentMonitor,
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
  PhysicalSize,
  primaryMonitor
} from '@tauri-apps/api/window'
import {
  MINI_PRESETS,
  clampMiniPosition,
  planPetPanel,
  type LogicalRect,
  type MiniSize,
  type PetPanelLayout
} from '../platform/miniWindow'
import { inTauri } from './inTauri'

type WindowHandle = ReturnType<typeof getCurrentWindow>

async function monitorArea(): Promise<{ area: LogicalRect; scale: number } | null> {
  const monitor =
    (await currentMonitor().catch(() => null)) ?? (await primaryMonitor().catch(() => null))
  if (!monitor) return null
  const scale = monitor.scaleFactor || 1
  return {
    scale,
    area: {
      x: monitor.workArea.position.x / scale,
      y: monitor.workArea.position.y / scale,
      width: monitor.workArea.size.width / scale,
      height: monitor.workArea.size.height / scale
    }
  }
}

function fitBrowser(size: MiniSize): PetPanelLayout {
  return planPetPanel(
    { x: 0, y: 0 },
    { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
    MINI_PRESETS[size]
  )
}

async function expandWindow(
  win: WindowHandle,
  anchor: PhysicalPosition,
  size: MiniSize
): Promise<PetPanelLayout> {
  const bounds = await monitorArea()
  if (!bounds) return { ...fitBrowser(size), arrangement: 'stack' }
  const { scale, area } = bounds
  const preset = MINI_PRESETS[size]
  const layout = planPetPanel({ x: anchor.x / scale, y: anchor.y / scale }, area, preset)
  await win.setMinSize(new LogicalSize(Math.min(preset.w, layout.w), Math.min(preset.h, layout.h)))
  await win.setPosition(
    new PhysicalPosition(Math.round(layout.x * scale), Math.round(layout.y * scale))
  )
  await win.setSize(new PhysicalSize(Math.floor(layout.w * scale), Math.floor(layout.h * scale)))
  return layout
}

async function restoreWindow(
  win: WindowHandle,
  anchor: PhysicalPosition,
  size: MiniSize
): Promise<void> {
  const preset = MINI_PRESETS[size]
  await win.setMinSize(new LogicalSize(preset.w, preset.h))
  await win.setSize(new LogicalSize(preset.w, preset.h))
  const bounds = await monitorArea()
  if (!bounds) {
    await win.setPosition(anchor)
    return
  }
  const { scale, area } = bounds
  const point = clampMiniPosition({ x: anchor.x / scale, y: anchor.y / scale }, area, preset)
  await win.setPosition(
    new PhysicalPosition(Math.round(point.x * scale), Math.round(point.y * scale))
  )
}

/** 面板只临时改变现有摆件窗口；IPC 串行，快速开关不会把中间坐标写进侧边停靠状态。 */
export function usePetPanelWindow(size: MiniSize) {
  const [layout, setLayout] = useState<PetPanelLayout | null>(null)
  const desired = useRef(false)
  const anchor = useRef<PhysicalPosition | null>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const inFlight = useRef(0)
  const currentSize = useRef(size)
  currentSize.current = size

  const setOpen = useCallback((open: boolean): Promise<void> => {
    desired.current = open
    if (!inTauri) {
      setLayout(open ? fitBrowser(currentSize.current) : null)
      return Promise.resolve()
    }
    if (!open) setLayout(null)
    inFlight.current += 1
    const task = queue.current
      .then(async () => {
        if (desired.current !== open) return
        const win = getCurrentWindow()
        if (open) {
          anchor.current ??= await win.outerPosition()
          const expanded = await expandWindow(win, anchor.current, currentSize.current)
          if (desired.current) setLayout(expanded)
        } else if (anchor.current) {
          await restoreWindow(win, anchor.current, currentSize.current)
          anchor.current = null
        }
      })
      .catch(() => {
        // Native sizing can fail (e.g. monitor disconnected). Keep the controls reachable in-window.
        if (open && desired.current)
          setLayout({ ...fitBrowser(currentSize.current), arrangement: 'stack' })
      })
      .finally(() => {
        inFlight.current -= 1
      })
    queue.current = task
    return task
  }, [])

  const isTemporary = useCallback(
    () => desired.current || inFlight.current > 0 || anchor.current !== null,
    []
  )
  const expanded = layout !== null
  useEffect(() => {
    if (!expanded) return
    const relayout = () => {
      if (desired.current) void setOpen(true)
    }
    if (inTauri) {
      const unlisten = getCurrentWindow().onScaleChanged(relayout)
      return () => {
        void unlisten.then((stop) => stop()).catch(() => {})
      }
    }
    window.addEventListener('resize', relayout)
    return () => window.removeEventListener('resize', relayout)
  }, [expanded, setOpen])

  return { layout, setOpen, isTemporary }
}
