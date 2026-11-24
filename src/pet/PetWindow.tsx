import { useEffect, useRef } from 'react'
import { currentMonitor, getCurrentWindow, LogicalPosition } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { useI18n } from '../i18n'
import { paletteFromDocument } from '../render/isoColor'
import { paintPet, type PetMood } from '../render/petCanvas'
import { PET_REST_POSE, petHopPose } from '../render/petMotion'
import { DEFAULT_PET_CONFIG, isPetSkinUnlocked, petSizeScale, type PetConfig } from './types'
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
import { isTauriRuntime, petOpenMain, petOpenSettings } from '../platform/petWindow'
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

const WALK_SPEED = 22 // 逻辑 px/s
const MOVE_IPC_MS = 50 // 20fps 更新窗口位置
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
    let nextBlink = performance.now() + 2200 + Math.random() * 2600
    let blinkUntil = 0
    let hopStart = 0
    let walkHopStart = 0
    let walkHopDirection: -1 | 1 = 1
    let nextWalkHopAt = 0
    let lastMove = 0
    let lastDraw = 0
    let disposed = false

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
      const skin =
        config.skin === 'robot' && isPetSkinUnlocked('robot', config.completed) ? 'bot' : 'block'

      if (!roam && mode === 'walk') {
        mode = 'idle'
        nextDecision = now + nextMoveDelay()
      }
      if (roam && mode === 'idle' && now >= nextDecision) {
        mode = 'walk'
        walkUntil = now + 2200 + Math.random() * 2400
        direction = Math.random() < 0.5 ? -1 : 1
        nextWalkHopAt = now
      } else if (mode === 'walk' && now >= walkUntil) {
        mode = 'idle'
        walkHopStart = 0
        nextDecision = now + nextMoveDelay()
      }

      if (mode === 'walk' && roam && !drag.active && now >= nextWalkHopAt) {
        walkHopStart = now
        walkHopDirection = direction
        nextWalkHopAt = now + 520
      }

      if (mode === 'walk' && roam && !drag.active) {
        const dt = Math.min(0.05, (now - lastMove) / 1000)
        if (now - lastMove >= MOVE_IPC_MS) {
          const step = stepPetWalk(pos, direction, WALK_SPEED * dt, area)
          pos = step.pos
          direction = step.direction
          lastMove = now
          if (inTauri && win)
            void win.setPosition(new LogicalPosition(pos.x, pos.y)).catch(() => {})
          if (now % 2000 < MOVE_IPC_MS) void persist()
        }
      }

      const bumpHop =
        now < bumpUntilRef.current
          ? Math.sin(((bumpUntilRef.current - now) / 1000) * Math.PI) * 8
          : 0
      const bubble =
        now < bubbleUntilRef.current && bubbleTextRef.current
          ? { text: bubbleTextRef.current, alpha: 1 }
          : undefined

      const palette = paletteFromDocument()
      const renderer = ctx as CanvasRenderingContext2D
      renderer.clearRect(0, 0, PET_SIZE.w, PET_SIZE.h)
      const pose = (hopStart > 0 && now - hopStart < HOP_MS
        ? petHopPose(now - hopStart, direction)
        : null) ??
        (walkHopStart > 0 && now - walkHopStart < HOP_MS
          ? petHopPose(now - walkHopStart, walkHopDirection)
          : null) ?? { ...PET_REST_POSE, lift: bumpHop }
      const mood: PetMood = now < bumpUntilRef.current ? 'happy' : 'idle'
      renderer.save()
      const sizeScale = petSizeScale(config.size)
      renderer.translate(PET_SIZE.w / 2, PET_SIZE.h)
      renderer.scale(sizeScale, sizeScale)
      renderer.translate(-PET_SIZE.w / 2, -PET_SIZE.h)
      paintPet(renderer, {
        width: PET_SIZE.w,
        height: PET_SIZE.h,
        model: skin,
        mood,
        palette,
        pose,
        blinking: blink === 0
      })
      renderer.restore()
      if (bubble) drawBubble(renderer, PET_SIZE.w, bubble.text, bubble.alpha, palette)
    }

    canvas.addEventListener('pointerdown', (event: PointerEvent) => {
      if (event.button !== 0) return
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
      if (inTauri && win) void win.setPosition(new LogicalPosition(pos.x, pos.y)).catch(() => {})
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
      // 点击左/右半区：朝对应方向短跳，跳中侧身、落地回正（旧版正面桌宠动作）。
      const rect = canvas.getBoundingClientRect()
      direction = event.clientX < rect.left + rect.width / 2 ? -1 : 1
      hopStart = now
      if (now - lastClickAt < 320) {
        lastClickAt = 0
        void petOpenMain()
      } else {
        lastClickAt = now
      }
    })

    canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      void petOpenSettings()
    })

    frame = requestAnimationFrame(tick)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      void persist()
    }
  }, [preview])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: preview ? 'var(--bg)' : 'transparent',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      <div style={{ width: PET_SIZE.w, height: PET_SIZE.h, overflow: 'hidden' }}>
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
