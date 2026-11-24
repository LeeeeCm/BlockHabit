import { useEffect, useRef, type RefObject } from 'react'
import { paletteFromDocument } from '../../render/isoColor'
import { paintPet, type PetMood } from '../../render/petCanvas'
import type { PetModel } from '../../render/petGeometry'
import { PET_REST_POSE, petHopPose, type PetDirection } from '../../render/petMotion'

const BLINK_DELAY_MS = 6000
const BLINK_MS = 140 // 与微反馈的 --dur-xs 时长一致
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function watchDpr(win: Window, redraw: () => void) {
  let resolution: MediaQueryList | undefined
  function bind() {
    resolution?.removeEventListener('change', onChange)
    // 监听真实 DPR；只限制位图密度，不限制对屏幕切换的检测。
    resolution = win.matchMedia?.(`(resolution: ${win.devicePixelRatio}dppx)`)
    resolution?.addEventListener('change', onChange)
  }
  function onChange() {
    bind()
    redraw()
  }
  bind()
  return () => resolution?.removeEventListener('change', onChange)
}

function createAnimator(
  win: Window,
  mood: PetMood,
  render: (pose: typeof PET_REST_POSE, blinking: boolean) => void
) {
  const media = win.matchMedia?.(MOTION_QUERY)
  let frame: number | undefined
  let blinkTimer: number | undefined
  let pose = PET_REST_POSE
  let blinking = false
  const draw = () => render(pose, blinking)

  function cancel() {
    if (frame !== undefined) win.cancelAnimationFrame(frame)
    if (blinkTimer !== undefined) win.clearTimeout(blinkTimer)
    frame = undefined
    blinkTimer = undefined
    pose = PET_REST_POSE
    blinking = false
  }
  function scheduleBlink() {
    if (media?.matches || mood !== 'idle') return
    blinkTimer = win.setTimeout(() => {
      blinking = true
      draw()
      blinkTimer = win.setTimeout(() => {
        blinking = false
        draw()
        scheduleBlink()
      }, BLINK_MS)
    }, BLINK_DELAY_MS)
  }
  function resetMotion() {
    cancel()
    draw()
    scheduleBlink()
  }
  function hop(direction: PetDirection) {
    if (media?.matches) return
    cancel()
    draw()
    const start = win.performance.now()
    function tick(now: number) {
      const next = petHopPose(now - start, direction)
      pose = next ?? PET_REST_POSE
      draw()
      frame = next ? win.requestAnimationFrame(tick) : undefined
      if (!next) scheduleBlink()
    }
    frame = win.requestAnimationFrame(tick)
  }

  media?.addEventListener('change', resetMotion)
  scheduleBlink()
  return {
    draw,
    hop,
    dispose: () => {
      media?.removeEventListener('change', resetMotion)
      cancel()
    }
  }
}

function attachPetCanvas(canvas: HTMLCanvasElement, win: Window, model: PetModel, mood: PetMood) {
  const doc = canvas.ownerDocument
  let palette = paletteFromDocument(doc)
  let context: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0

  const animation = createAnimator(win, mood, (pose, blinking) => {
    if (!width || !height || !palette.top || !palette.left || !palette.right || !palette.ink) return
    context ??= canvas.getContext('2d')
    if (!context) return
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
    context.clearRect(0, 0, width, height)
    paintPet(context, { width, height, model, mood, palette, pose, blinking })
  })

  function resize() {
    const bounds = canvas.getBoundingClientRect()
    width = bounds.width
    height = bounds.height
    if (!width || !height) return
    const dpr = Math.min(win.devicePixelRatio || 1, 2)
    const pixelWidth = Math.max(1, Math.round(width * dpr))
    const pixelHeight = Math.max(1, Math.round(height * dpr))
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight
    animation.draw()
  }

  const styleObserver = new MutationObserver(() => {
    palette = paletteFromDocument(doc)
    animation.draw()
  })
  // App 的主题 effect 可能在子组件首帧之后才写 data-theme。
  styleObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const sizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : undefined
  sizeObserver?.observe(canvas)
  const stopDpr = watchDpr(win, resize)
  resize()

  return {
    hop: animation.hop,
    dispose: () => {
      styleObserver.disconnect()
      sizeObserver?.disconnect()
      stopDpr()
      animation.dispose()
    }
  }
}

export function usePetAvatarCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  model: PetModel,
  mood: PetMood
): (direction: PetDirection) => void {
  const hopRef = useRef<(direction: PetDirection) => void>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const win = canvas?.ownerDocument.defaultView
    if (!canvas || !win) return
    const renderer = attachPetCanvas(canvas, win, model, mood)
    hopRef.current = renderer.hop
    return () => {
      hopRef.current = null
      renderer.dispose()
    }
  }, [canvasRef, model, mood])
  return (direction) => hopRef.current?.(direction)
}
