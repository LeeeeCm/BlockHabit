import { act, createRef, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paletteFromDocument } from '../../render/isoColor'
import { paintPet } from '../../render/petCanvas'
import { PET_REST_POSE, petHopPose, type PetDirection } from '../../render/petMotion'
import { PetAvatar } from './PetAvatar'

function stageRect(width: number, height: number): DOMRect {
  return new DOMRect(0, 0, width, height)
}

function canvasContext() {
  const gradient = { addColorStop: vi.fn<(position: number, color: string) => void>() }
  const noop = () => {}
  return {
    translate: vi.fn<(x: number, y: number) => void>(),
    clearRect: vi.fn(),
    addColorStop: gradient.addColorStop,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    setTransform: noop,
    transform: noop,
    save: noop,
    restore: noop,
    scale: vi.fn<(x: number, y: number) => void>(),
    arc: noop,
    arcTo: noop,
    beginPath: noop,
    clip: noop,
    closePath: noop,
    ellipse: noop,
    fill: noop,
    lineTo: noop,
    moveTo: noop,
    quadraticCurveTo: noop,
    rect: noop,
    stroke: noop
  }
}

const motionQuery = '(prefers-reduced-motion: reduce)'

describe('PetAvatar', () => {
  let container: HTMLDivElement
  let root: Root
  let stylesheet: HTMLStyleElement
  let ctx: ReturnType<typeof canvasContext>
  let mediaQueries: Map<string, EventTarget & { matches: boolean }>

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.useFakeTimers({
      toFake: [
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'setTimeout',
        'clearTimeout',
        'performance'
      ]
    })
    vi.stubGlobal('devicePixelRatio', 1.25)
    mediaQueries = new Map()
    vi.stubGlobal('matchMedia', (query: string) => {
      const media = Object.assign(new EventTarget(), { matches: false })
      mediaQueries.set(query, media)
      return media
    })
    ctx = canvasContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ctx as unknown as CanvasRenderingContext2D
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
      stageRect(220, 36)
    )
    vi.spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect').mockReturnValue(
      stageRect(220, 36)
    )
    stylesheet = document.createElement('style')
    stylesheet.textContent = `
      :root { --block-top: #f4f4f4; --block-left: #c9c9c9; --block-right: #8a8a8a; --ink: #0a0a0a; }
      :root[data-theme='pet-test-dark'] { --block-top: #424242; --block-left: #303030; --block-right: #1c1c1c; --ink: #fafafa; }
    `
    document.head.append(stylesheet)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    document.documentElement.removeAttribute('data-theme')
    stylesheet.remove()
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function mount(node: ReactNode, selector: 'button'): HTMLButtonElement {
    act(() => root.render(node))
    const button = container.querySelector(selector)
    if (!button) throw new Error('PetAvatar must render a button')
    return button
  }

  function stageX() {
    const translations = ctx.translate.mock.calls.filter(([x]) => x > 55 && x < 165)
    return translations[translations.length - 1]?.[0]
  }

  it('exposes a named native dialog trigger and scopes menu keys to it', () => {
    const onToggleMenu = vi.fn()
    const buttonRef = createRef<HTMLButtonElement>()
    const button = mount(
      <PetAvatar
        model="block"
        mood="idle"
        label="Pet actions"
        menuOpen={false}
        onToggleMenu={onToggleMenu}
        buttonRef={buttonRef}
      />,
      'button'
    )
    expect(buttonRef.current).toBe(button)
    expect(button.getAttribute('aria-label')).toBe('Pet actions')
    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true')
    const contextMenu = new MouseEvent('contextmenu', { cancelable: true, bubbles: true })
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true })
      )
      button.dispatchEvent(contextMenu)
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true }))
      // Windows/Blink 的菜单键默认动作走 keyup；未取消时模拟原生 contextmenu。
      const keyUp = new KeyboardEvent('keyup', {
        key: 'ContextMenu',
        bubbles: true,
        cancelable: true
      })
      if (button.dispatchEvent(keyUp)) {
        button.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
      }
      button.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true })
      )
      button.click()
    })
    expect(contextMenu.defaultPrevented).toBe(true)
    expect(onToggleMenu).toHaveBeenCalledTimes(4)
  })

  it('uses the pointer half or arrow key for direction, not for opening the dialog', () => {
    const onToggleMenu = vi.fn()
    const button = mount(
      <PetAvatar
        model="cat"
        mood="focus"
        label="Pet actions"
        menuOpen
        onToggleMenu={onToggleMenu}
      />,
      'button'
    )
    expect(button.getAttribute('aria-expanded')).toBe('true')
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { detail: 1, clientX: 16, bubbles: true }))
      vi.advanceTimersByTime(112)
    })
    expect(stageX()).toBeLessThan(110)
    act(() => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      vi.advanceTimersByTime(112)
    })
    expect(stageX()).toBeGreaterThan(110)
    expect(onToggleMenu).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(500))
    expect(stageX()).toBe(110)
    const draws = ctx.clearRect.mock.calls.length
    act(() => vi.advanceTimersByTime(1000))
    expect(ctx.clearRect).toHaveBeenCalledTimes(draws)
  })

  it('cancels an active hop and pending blinks when reduced motion is enabled', () => {
    const button = mount(
      <PetAvatar
        model="bot"
        mood="idle"
        label="Pet actions"
        menuOpen={false}
        onToggleMenu={vi.fn()}
      />,
      'button'
    )
    act(() => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
      vi.advanceTimersByTime(112)
    })
    expect(stageX()).toBeLessThan(110)
    const media = mediaQueries.get(motionQuery)!
    act(() => {
      media.matches = true
      media.dispatchEvent(new Event('change'))
    })
    expect(stageX()).toBe(110)
    const draws = ctx.clearRect.mock.calls.length
    act(() => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      vi.advanceTimersByTime(12000)
    })
    expect(ctx.clearRect).toHaveBeenCalledTimes(draws)
  })

  it('repaints in the new theme after the root theme effect', async () => {
    document.documentElement.dataset.theme = 'pet-test-light'
    mount(
      <PetAvatar
        model="block"
        mood="ready"
        label="Pet actions"
        menuOpen={false}
        onToggleMenu={vi.fn()}
      />,
      'button'
    )
    expect(ctx.addColorStop).toHaveBeenCalledWith(0, 'rgb(201,201,201)')
    ctx.addColorStop.mockClear()
    await act(async () => {
      document.documentElement.dataset.theme = 'pet-test-dark'
    })
    expect(ctx.addColorStop).toHaveBeenCalledWith(0, 'rgb(48,48,48)')
    expect(ctx.addColorStop).not.toHaveBeenCalledWith(0, 'rgb(201,201,201)')
  })

  it('draws two frames for an idle blink without scheduling RAF', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    mount(
      <PetAvatar
        model="block"
        mood="idle"
        label="Pet actions"
        menuOpen={false}
        onToggleMenu={vi.fn()}
      />,
      'button'
    )
    const frames = ctx.clearRect.mock.calls.length
    act(() => vi.advanceTimersByTime(6200))
    expect(ctx.clearRect).toHaveBeenCalledTimes(frames + 2)
    expect(raf).not.toHaveBeenCalled()
  })

  it.each([
    [-1, 'rgb(201,201,201)', 'rgb(138,138,138)'],
    [1, 'rgb(138,138,138)', 'rgb(201,201,201)']
  ] as const)(
    'keeps the viewer-left face lighter at the %s hop peak',
    (direction: PetDirection, front: string, side: string) => {
      paintPet(ctx as unknown as CanvasRenderingContext2D, {
        width: 280,
        height: 220,
        model: 'block',
        mood: 'idle',
        palette: paletteFromDocument(),
        pose: petHopPose(120, direction)!,
        blinking: false
      })
      const surfaceColors = ctx.addColorStop.mock.calls
        .filter(([stop, color]) => stop === 0 && color.startsWith('rgb('))
        .map(([, color]) => color)
      expect(surfaceColors).toEqual([front, 'rgb(244,244,244)', side])
    }
  )

  it('fills a roomier stage with a roughly 100 px frontal silhouette', () => {
    paintPet(ctx as unknown as CanvasRenderingContext2D, {
      width: 280,
      height: 220,
      model: 'block',
      mood: 'idle',
      palette: paletteFromDocument(),
      pose: PET_REST_POSE,
      blinking: false
    })
    const faceWidth = ctx.scale.mock.calls[0][0] * 34
    expect(faceWidth).toBeGreaterThanOrEqual(96)
    expect(faceWidth).toBeLessThanOrEqual(110)
  })

  it('rebuilds the canvas backing store when only DPR changes at pocket height', () => {
    const button = mount(
      <PetAvatar
        model="block"
        mood="ready"
        label="Pet actions"
        menuOpen={false}
        onToggleMenu={vi.fn()}
      />,
      'button'
    )
    const canvas = button.querySelector('canvas')
    expect(canvas?.width).toBe(275)
    expect(canvas?.height).toBe(45)
    const oldResolution = mediaQueries.get('(resolution: 1.25dppx)')!
    act(() => {
      vi.stubGlobal('devicePixelRatio', 1.5)
      oldResolution.dispatchEvent(new Event('change'))
    })
    expect(canvas?.width).toBe(330)
    expect(canvas?.height).toBe(54)
    expect(mediaQueries.has('(resolution: 1.5dppx)')).toBe(true)
  })
})
