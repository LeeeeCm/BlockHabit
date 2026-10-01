import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAppStore } from '../store/appStore'
import { MiniDeskToy } from './MiniDeskToy'

vi.mock('../audio/sound', () => ({
  playSnapSound: vi.fn(),
  playJellySound: vi.fn(),
  playCelebrationSound: vi.fn(),
}))

const mockTodayKey = vi.hoisted(() => vi.fn().mockReturnValue('2026-09-30'))
vi.mock('../logic/useTodayKey', () => ({
  useTodayKey: () => mockTodayKey(),
}))
// store 的 checkIn 也必须使用同一个 mock 天，否则打卡落真实今天、断言落 mock 天
vi.mock('../logic/dates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../logic/dates')>()
  return { ...actual, todayKey: () => mockTodayKey() }
})

describe('MiniDeskToy component', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof window.ResizeObserver

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (q: string) => ({
        matches: false,
        media: q,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })

    container = document.createElement('div')
    document.body.appendChild(container)
    useAppStore.setState({
      habits: [
        {
          id: 'h1',
          name: '晨跑',
          frequency: { type: 'daily' },
          createdAt: '2026-09-01T00:00:00.000Z',
        },
        {
          id: 'h2',
          name: '阅读',
          frequency: { type: 'daily' },
          createdAt: '2026-09-01T00:00:00.000Z',
        },
      ],
      checkIns: [
        {
          id: 'c1',
          habitId: 'h1',
          date: '2026-09-30',
          at: '2026-09-30T08:00:00.000Z',
        },
      ],
      activeBlueprintId: 'plant',
      builds: [],
    })
  })

  afterEach(() => {
    if (container.parentElement) {
      document.body.removeChild(container)
    }
  })

  it('renders pending habits using responsive useTodayKey', () => {
    const root = createRoot(container)
    act(() => {
      root.render(<MiniDeskToy onExpand={vi.fn()} onClose={vi.fn()} />)
    })

    // h1 已在 2026-09-30 打卡，h2 未打卡 -> 待办中只有阅读
    expect(container.textContent).toContain('阅读')
    // 待办按钮数量
    const habitButtons = container.querySelectorAll('.pill-action')
    expect(habitButtons.length).toBe(1)
    expect(habitButtons[0].textContent).toContain('阅读')

    act(() => {
      root.unmount()
    })
  })

  it('performs quick check-in when clicking pending habit button', () => {
    const root = createRoot(container)
    act(() => {
      root.render(<MiniDeskToy onExpand={vi.fn()} onClose={vi.fn()} />)
    })

    const btn = container.querySelector('.pill-action') as HTMLButtonElement
    expect(btn).not.toBeNull()

    act(() => {
      btn.click()
    })

    // 打卡后 h2 也已完成，待办列表刷新为全勤完成状态
    const checkIns = useAppStore.getState().checkIns
    expect(checkIns.some((c) => c.habitId === 'h2' && c.date === '2026-09-30')).toBe(true)

    act(() => {
      root.unmount()
    })
  })
  it('updates pending habits across midnight date flip', () => {
    mockTodayKey.mockReturnValue('2026-09-30')
    const root = createRoot(container)
    act(() => {
      root.render(<MiniDeskToy onExpand={vi.fn()} onClose={vi.fn()} />)
    })

    // 2026-09-30 时：h1 已打卡，h2 未打卡 -> 待办中只有阅读
    expect(container.querySelectorAll('.pill-action').length).toBe(1)

    // 跨过午夜至 2026-10-01，两项均未在新日期打卡 -> 待办变为 2 项
    mockTodayKey.mockReturnValue('2026-10-01')
    act(() => {
      root.render(<MiniDeskToy onExpand={vi.fn()} onClose={vi.fn()} />)
    })

    expect(container.querySelectorAll('.pill-action').length).toBe(2)

    act(() => {
      root.unmount()
    })
  })
})
