import { useEffect, useRef, useState } from 'react'
import { currentMonitor, getCurrentWindow, LogicalPosition } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { useI18n } from '../i18n'
import { paletteFromDocument, deriveShadingForColor } from '../render/isoColor'
import { paintPet, petStageFloor, type PetMood } from '../render/petCanvas'
import { PET_REST_POSE, petHopPose, type PetPose } from '../render/petMotion'
import { DEFAULT_PET_CONFIG, petSizeScale, type PetConfig } from './types'
import {
  PET_SIZE,
  clampPetPosition,
  defaultPetPosition,
  nextMoveDelay,
  stepPetWalk,
  type PetPoint,
  type PetWorkArea
} from '../platform/petMotion'
import { loadPetPosition, savePetPosition } from '../platform/windowLayout'
import { isTauriRuntime, petOpenMain, togglePetMenu } from '../platform/petWindow'
import './petWindow.css'

function drawBubble(
  ctx: CanvasRenderingContext2D,
  width: number,
  text: string,
  alpha: number,
  palette: { top: string; ink: string }
): void {
  if (!text || alpha <= 0) return
  ctx.save()
  ctx.globalAlpha = Math.min(1, alpha)
  ctx.font = '600 10px "Rubik", "MiSans", sans-serif'
  const bubbleWidth = Math.max(30, ctx.measureText(text).width + 16)
  const x = width / 2 - bubbleWidth / 2
  const y = 8
  ctx.fillStyle = palette.top
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(x, y, bubbleWidth, 20, 10)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = palette.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width / 2, y + 10)
  ctx.restore()
}

interface Props {
  /** 浏览器预览：不操作真实窗口，只画角色 */
  preview?: boolean
}

const HOP_DISTANCE = 16 // 每次自主短跳的窗口位移
const HOP_INTERVAL_MS = 520
const PERSIST_EVERY_MS = 8000
const DRAW_FPS_MS = 16
const HOP_MS = 400

/**
 * 积木桌宠窗口（D-20261124-088）。
 *
 * - 透明置顶小窗；block 是一块会跳的积木，robot 是积木机器人；
 * - idle 呼吸 + 眨眼，walk 左右移动并碰边反弹；
 * - 拖动改位置；单击跳一下；双击唤起主窗；右键打开桌宠设置。
 * - 主窗通过 `pet-config` 事件同步形象 / 大小 / 是否走动 / 今日打卡进度。
 */
export function PetWindow({ preview = false }: Props) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const configRef = useRef<PetConfig>(DEFAULT_PET_CONFIG)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuOpenRef = useRef(false)
  menuOpenRef.current = menuOpen
  const prevDoneRef = useRef(0)
  const bumpUntilRef = useRef(0)
  const bubbleUntilRef = useRef(0)
  const bubbleTextRef = useRef('')

  useEffect(() => {
    if (preview || !isTauriRuntime()) return
    let disposed = false
    const unlisten = listen<PetConfig>('pet-config', (event) => {
      const config = event.payload
      if (!config || disposed) return
      configRef.current = config
      if (config.total > 0 && config.done > prevDoneRef.current) {
        const now = performance.now()
        bumpUntilRef.current = now + 1000
        bubbleUntilRef.current = now + 2600
        bubbleTextRef.current = `${config.done}/${config.total}`
      }
      prevDoneRef.current = config.done
    })
    return () => {
      disposed = true
      void unlisten.then((fn) => fn()).catch(() => {})
    }
  }, [preview])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
    canvas.width = Math.round(PET_SIZE.w * dpr)
    canvas.height = Math.round(PET_SIZE.h * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const inTauri = isTauriRuntime() && !preview
    const win = inTauri ? getCurrentWindow() : null

    let area: PetWorkArea = { x: 0, y: 0, width: 1440, height: 900 }
    let pos: PetPoint = loadPetPosition() ?? defaultPetPosition(area)
    let direction: -1 | 1 = 1
    let mode: 'idle' | 'walk' = 'idle'
    let nextDecision = performance.now() + nextMoveDelay()
    let walkUntil = 0
    let nextIdleAction = performance.now() + 3500 + Math.random() * 4500
    let idleActionStart = 0
    let idleActionKind: 'look' | 'stretch' | 'hop' = 'look'
    let idleActionDirection: -1 | 1 = 1
    let nextBlink = performance.now() + 2200 + Math.random() * 2600
    let blinkUntil = 0
    let walkHopStart = 0
    let walkHopDirection: -1 | 1 = 1
    let walkFromX = 0
    let walkToX = 0
    let nextWalkHopAt = 0
    let lastPersist = 0
    let lastDraw = 0
    let disposed = false
    let palette = paletteFromDocument()
    const themeObserver = new MutationObserver(() => {
      palette = paletteFromDocument()
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })

    const drag = {
      active: false,
      moved: false,
      startScreenX: 0,
      startScreenY: 0,
      startWin: { x: 0, y: 0 },
      scale: 1
    }

    void (async () => {
      if (!inTauri || !win) return
      const monitor = await currentMonitor().catch(() => null)
      if (!monitor || disposed) return
      const f = monitor.scaleFactor || 1
      area = {
        x: monitor.workArea.position.x / f,
        y: monitor.workArea.position.y / f,
        width: monitor.workArea.size.width / f,
        height: monitor.workArea.size.height / f
      }
      pos = clampPetPosition(loadPetPosition() ?? defaultPetPosition(area), area)
      await win.setPosition(new LogicalPosition(pos.x, pos.y)).catch(() => {})
      await win.setAlwaysOnTop(true).catch(() => {})
    })()

    async function persist() {
      if (inTauri) savePetPosition(pos)
    }

    // latest-wins：只保留最新位置，避免 60fps 位移请求在 IPC 队列里堆积
    let pendingMove: { x: number; y: number } | null = null
    let moving = false
    async function flushMove() {
      if (!win || moving) return
      moving = true
      try {
        while (pendingMove) {
          const next = pendingMove
          pendingMove = null
          await win.setPosition(new LogicalPosition(next.x, next.y)).catch(() => {})
        }
      } finally {
        moving = false
      }
    }
    function moveTo(x: number, y: number) {
      if (!win) return
      pendingMove = { x, y }
      void flushMove()
    }

    let frame = 0
    function tick(now: number) {
      if (disposed) return
      frame = requestAnimationFrame(tick)

      if (now - lastDraw < DRAW_FPS_MS) return
      lastDraw = now

      if (now >= nextBlink) {
        blinkUntil = now + 120
        nextBlink = now + 2400 + Math.random() * 3000
      }
      const blink = now < blinkUntil ? 0 : 1
      const config = configRef.current
      const roam = config.roam !== false
      const skin = config.skin

      if (menuOpenRef.current) {
        if (mode === 'walk') {
          mode = 'idle'
          walkHopStart = 0
          nextDecision = now + nextMoveDelay()
        }
      } else if (!roam && mode === 'walk') {
        mode = 'idle'
        nextDecision = now + nextMoveDelay()
      }
      if (!menuOpenRef.current && roam && mode === 'idle' && now >= nextDecision) {
        mode = 'walk'
        walkUntil = now + 1200 + Math.random() * 1200
        direction = Math.random() < 0.5 ? -1 : 1
        nextWalkHopAt = now
        idleActionStart = 0
        nextIdleAction = now + 5000 + Math.random() * 5000
      } else if (mode === 'walk' && now >= walkUntil && walkHopStart === 0) {
        mode = 'idle'
        nextDecision = now + nextMoveDelay()
      }

      if (!menuOpenRef.current && mode === 'walk' && roam && !drag.active) {
        if (now >= nextWalkHopAt) {
          const step = stepPetWalk(pos, direction, HOP_DISTANCE, area)
          walkFromX = pos.x
          walkToX = step.pos.x
          walkHopDirection = direction
          direction = step.direction
          walkHopStart = now
          nextWalkHopAt = now + HOP_INTERVAL_MS
        }
        if (walkHopStart > 0) {
          const t = Math.min(1, (now - walkHopStart) / HOP_MS)
          const eased = t * t * (3 - 2 * t)
          pos = { ...pos, x: walkFromX + (walkToX - walkFromX) * eased }
          if (inTauri) moveTo(pos.x, pos.y)
          if (t >= 1) {
            pos = { ...pos, x: walkToX }
            walkHopStart = 0
          }
        }
        if (now - lastPersist >= PERSIST_EVERY_MS) {
          lastPersist = now
          void persist()
        }
      }

      if (menuOpenRef.current || mode === 'walk' || drag.active) {
        idleActionStart = 0
      } else {
        if (idleActionStart > 0 && now - idleActionStart >= 900) idleActionStart = 0
        if (idleActionStart === 0 && now >= nextIdleAction) {
          const kinds: Array<'look' | 'stretch' | 'hop'> = ['look', 'stretch', 'hop']
          idleActionKind = kinds[Math.floor(Math.random() * kinds.length)]
          idleActionDirection = Math.random() < 0.5 ? -1 : 1
          idleActionStart = now
          nextIdleAction = now + 7000 + Math.random() * 6000
        }
      }

      let idlePose: Readonly<PetPose> | null = null
      if (idleActionStart > 0 && now - idleActionStart < 900) {
        const t = (now - idleActionStart) / 900
        const arc = Math.sin(Math.PI * t)
        idlePose =
          idleActionKind === 'look'
            ? { ...PET_REST_POSE, turn: idleActionDirection * arc * 0.35 }
            : idleActionKind === 'stretch'
              ? {
                  ...PET_REST_POSE,
                  lift: arc * 2,
                  scaleX: 1 - arc * 0.04,
                  scaleY: 1 + arc * 0.07
                }
              : { ...PET_REST_POSE, lift: arc * 7 }
      }

      const bumpHop =
        now < bumpUntilRef.current
          ? Math.sin(((bumpUntilRef.current - now) / 1000) * Math.PI) * 8
          : 0
      const bubble =
        now < bubbleUntilRef.current && bubbleTextRef.current
          ? { text: bubbleTextRef.current, alpha: 1 }
          : undefined

      const paletteNow = palette
      const renderer = ctx as CanvasRenderingContext2D
      renderer.clearRect(0, 0, PET_SIZE.w, PET_SIZE.h)
      const pose = (walkHopStart > 0 && now - walkHopStart < HOP_MS
        ? petHopPose(now - walkHopStart, walkHopDirection)
        : null) ??
        idlePose ?? { ...PET_REST_POSE, lift: bumpHop }
      const visualPose = { ...pose, x: 0 }
      const mood: PetMood =
        now < bumpUntilRef.current ||
        (idleActionStart > 0 && idleActionKind === 'stretch' && now - idleActionStart < 900)
          ? 'happy'
          : 'idle'
      renderer.save()
      const sizeScale = petSizeScale(config.size)
      const floor = petStageFloor(PET_SIZE.w, PET_SIZE.h)
      renderer.translate(PET_SIZE.w / 2, floor)
      renderer.scale(sizeScale, sizeScale)
      renderer.translate(-PET_SIZE.w / 2, -floor)
      paintPet(renderer, {
        width: PET_SIZE.w,
        height: PET_SIZE.h,
        model: skin,
        mood,
        palette: paletteNow,
        shading: config.color ? deriveShadingForColor(config.color) : undefined,
        pose: visualPose,
        blinking: blink === 0
      })
      renderer.restore()
      if (bubble) drawBubble(renderer, PET_SIZE.w, bubble.text, bubble.alpha, paletteNow)
    }

    canvas.addEventListener('pointerdown', (event: PointerEvent) => {
      if (event.button !== 0 || menuOpenRef.current) return
      drag.active = true
      drag.moved = false
      drag.startScreenX = event.screenX
      drag.startScreenY = event.screenY
      drag.scale = window.devicePixelRatio || 1
      drag.startWin = { x: pos.x, y: pos.y }
      void (async () => {
        if (!inTauri || !win) return
        const outer = await win.outerPosition().catch(() => null)
        const scale = (await win.scaleFactor().catch(() => drag.scale)) || drag.scale
        drag.scale = scale
        drag.startWin = outer ? { x: outer.x / scale, y: outer.y / scale } : { x: pos.x, y: pos.y }
      })()
      ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    })

    let lastClickAt = 0
    canvas.addEventListener('pointermove', (event: PointerEvent) => {
      if (!drag.active) return
      const dx = (event.screenX - drag.startScreenX) / drag.scale
      const dy = (event.screenY - drag.startScreenY) / drag.scale
      if (!drag.moved && Math.hypot(dx, dy) < 4) return
      drag.moved = true
      const next = clampPetPosition({ x: drag.startWin.x + dx, y: drag.startWin.y + dy }, area)
      pos = next
      if (inTauri) moveTo(pos.x, pos.y)
    })

    canvas.addEventListener('pointerup', (event: PointerEvent) => {
      if (!drag.active) return
      drag.active = false
      ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
      if (drag.moved) {
        void persist()
        lastClickAt = 0
        return
      }
      const now = performance.now()
      if (now - lastClickAt < 320) {
        lastClickAt = 0
        void petOpenMain()
      } else {
        lastClickAt = now
      }
    })

    canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      void togglePetMenu().then((visible) => setMenuOpen(visible))
    })

    frame = requestAnimationFrame(tick)
    return () => {
      disposed = true
      themeObserver.disconnect()
      cancelAnimationFrame(frame)
      void persist()
    }
  }, [preview])

  useEffect(() => {
    if (preview || !isTauriRuntime()) return
    let disposed = false
    const unlisten = listen<boolean>('pet-menu-state', (event) => {
      if (!disposed) setMenuOpen(Boolean(event.payload))
    })
    return () => {
      disposed = true
      void unlisten.then((fn) => fn()).catch(() => {})
    }
  }, [preview])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        background: preview ? 'var(--bg)' : 'transparent',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      <div style={{ width: PET_SIZE.w, height: PET_SIZE.h, flexShrink: 0, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={t.pet.hint}
          title={t.pet.hint}
          style={{
            width: PET_SIZE.w,
            height: PET_SIZE.h,
            display: 'block',
            cursor: 'grab',
            touchAction: 'none'
          }}
        />
      </div>
    </div>
  )
}
