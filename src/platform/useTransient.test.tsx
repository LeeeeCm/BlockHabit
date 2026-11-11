import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransient } from './useTransient'

/**
 * D5 遗留（D-20261110-036）：瞬时提示的计时器管理。
 *
 * 修复前：每个组件都是「setToast(msg) + setTimeout(() => setToast(null), N)」，
 * 连续弹两次提示时，**第一次的计时器会把第二次提前清掉**；组件卸载后计时器也不清理。
 */
interface Api {
  show: (value: string | null, durationMs?: number) => void
  value: () => string | null
}

function Probe({ onReady }: { onReady: (api: Api) => void }) {
  const [value, show] = useTransient<string>(1000)
  onReady({ show, value: () => value })
  return null
}

let container: HTMLDivElement
let root: Root
let api: Api

beforeEach(() => {
  vi.useFakeTimers()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(<Probe onReady={(a) => (api = a)} />)
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('useTransient', () => {
  it('到时自动清空', () => {
    act(() => api.show('喝一杯水'))
    expect(api.value()).toBe('喝一杯水')
    act(() => vi.advanceTimersByTime(999))
    expect(api.value()).toBe('喝一杯水')
    act(() => vi.advanceTimersByTime(1))
    expect(api.value()).toBeNull()
  })

  it('连续两次提示：第一次的计时器不会把第二次提前清掉', () => {
    act(() => api.show('第一条'))
    act(() => vi.advanceTimersByTime(500))
    act(() => api.show('第二条'))
    // 走到第一条原本的截止时刻（1000ms）之后，第二条仍应在
    act(() => vi.advanceTimersByTime(800))
    expect(api.value()).toBe('第二条')
    // 第二条自己的 1000ms 到了才消失
    act(() => vi.advanceTimersByTime(200))
    expect(api.value()).toBeNull()
  })

  it('时长 0 表示常驻，不被自动清空', () => {
    act(() => api.show('常驻提示', 0))
    act(() => vi.advanceTimersByTime(60_000))
    expect(api.value()).toBe('常驻提示')
  })

  it('show(null) 立即清空', () => {
    act(() => api.show('临时'))
    act(() => api.show(null))
    expect(api.value()).toBeNull()
  })

  it('卸载后计时器被清理（无悬挂定时器）', () => {
    act(() => api.show('即将卸载'))
    expect(vi.getTimerCount()).toBe(1)
    act(() => root.unmount())
    expect(vi.getTimerCount()).toBe(0)
    // 重新挂载以便 afterEach 的 unmount 安全
    root = createRoot(container)
  })
})
