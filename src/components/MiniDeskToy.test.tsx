import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAppStore } from '../store/appStore'
import {
  FOCUS_SESSIONS_STORAGE_KEY,
  readFocusSessions,
  useTimerStore,
} from '../store/timerStore'
import { MINI_PRESETS } from '../platform/miniWindow'
import { getTranslation } from '../i18n'
import { MiniDeskToy } from './MiniDeskToy'

vi.mock('../audio/sound', () => ({
  playSnapSound: vi.fn(),
  playJellySound: vi.fn(),
  playCelebrationSound: vi.fn(),
}))

// 摆件用 triggerHaptic 做手感反馈；测试里不触达平台层
vi.mock('../platform', () => ({ triggerHaptic: vi.fn() }))

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
    localStorage.clear()
    useTimerStore.setState({ sessions: {} })
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
      root.render(<MiniDeskToy size="standard" pinned={false} onTogglePin={vi.fn()} onExpand={vi.fn()} onClose={vi.fn()} />)
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
      root.render(<MiniDeskToy size="standard" pinned={false} onTogglePin={vi.fn()} onExpand={vi.fn()} onClose={vi.fn()} />)
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
      root.render(<MiniDeskToy size="standard" pinned={false} onTogglePin={vi.fn()} onExpand={vi.fn()} onClose={vi.fn()} />)
    })

    // 2026-09-30 时：h1 已打卡，h2 未打卡 -> 待办中只有阅读
    expect(container.querySelectorAll('.pill-action').length).toBe(1)

    // 跨过午夜至 2026-10-01，两项均未在新日期打卡 -> 待办变为 2 项
    mockTodayKey.mockReturnValue('2026-10-01')
    act(() => {
      root.render(<MiniDeskToy size="standard" pinned={false} onTogglePin={vi.fn()} onExpand={vi.fn()} onClose={vi.fn()} />)
    })

    expect(container.querySelectorAll('.pill-action').length).toBe(2)

    act(() => {
      root.unmount()
    })
  })

  it('pocket 档只给 1 个快捷打卡，并显示下一里程碑', () => {
    const root = createRoot(container)
    act(() => {
      root.render(
        <MiniDeskToy
          size="pocket"
          pinned={false}
          onTogglePin={vi.fn()}
          onExpand={vi.fn()}
          onClose={vi.fn()}
        />,
      )
    })
    const pills = container.querySelectorAll('.pill-action')
    expect(pills.length).toBe(1)
    expect(container.textContent).toContain('blocks to finish')
    expect((pills[0] as HTMLElement).style.minHeight).toBe('32px')
    act(() => root.unmount())
  })

  it('display 档显示今日清单（不是胶囊），行高 ≥32px', () => {
    const root = createRoot(container)
    act(() => {
      root.render(
        <MiniDeskToy
          size="display"
          pinned={false}
          onTogglePin={vi.fn()}
          onExpand={vi.fn()}
          onClose={vi.fn()}
        />,
      )
    })
    expect(container.querySelectorAll('.pill-action').length).toBe(0)
    expect(container.textContent).toContain('Today')
    expect(container.textContent).toContain('阅读')
    const rows = [...container.querySelectorAll('button')].filter((b) => b.textContent?.includes('阅读'))
    expect(rows.length).toBeGreaterThan(0)
    expect((rows[0] as HTMLElement).style.minHeight).toBe('32px')
    act(() => root.unmount())
  })

  describe('专注陪伴（B2 / D-20261110-064）', () => {
    beforeEach(() => {
      mockTodayKey.mockReturnValue('2026-09-30')
    })

    const en = getTranslation('en')
    const MINUTE = 60_000
    const renderToy = (size: 'pocket' | 'standard' | 'display') => {
      const root = createRoot(container)
      act(() => {
        root.render(<MiniDeskToy size={size} pinned={false} onTogglePin={vi.fn()} onExpand={vi.fn()} onClose={vi.fn()} />)
      })
      return root
    }

    it('focusing：摆件切到专注面板（倒计时），口袋档不再显示快捷打卡', () => {
      useTimerStore.getState().start('h2', 25 * MINUTE)
      const root = renderToy('pocket')

      const panel = container.querySelector('[data-testid="focus-panel"]') as HTMLElement
      expect(panel).not.toBeNull()
      expect(panel.dataset.focusPhase).toBe('focusing')
      expect(container.textContent).toContain('阅读')
      expect(container.textContent).toMatch(/\d{2}:\d{2}/)
      // 口袋档专注面板铺满内容区（不裁切），不再渲染快捷打卡胶囊
      expect(panel.style.flexGrow).toBe('1')
      expect(container.querySelectorAll('.pill-action').length).toBe(0)
      act(() => root.unmount())
    })

    it('standard / display：专注面板占底部固定高度（预设 footerH），3D 场景仍在', () => {
      useTimerStore.getState().start('h2', 25 * MINUTE)
      for (const size of ['standard', 'display'] as const) {
        const root = renderToy(size)
        const panel = container.querySelector('[data-testid="focus-panel"]') as HTMLElement
        expect(panel).not.toBeNull()
        expect(panel.style.height).toBe('100%')
        const holder = panel.parentElement as HTMLElement
        expect(holder.style.height).toBe(MINI_PRESETS[size].footerH + 'px')
        expect(container.querySelector('canvas')).not.toBeNull()
        act(() => root.unmount())
      }
    })

    it('ready：到点显示「确认落块 / 再等 5 分钟 / 放弃」，确认后才 checkIn 并清除会话', () => {
      act(() => {
        useTimerStore.setState({
          sessions: { h2: { startedAt: Date.now() - 26 * MINUTE, targetMs: 25 * MINUTE } },
        })
      })
      const root = renderToy('standard')
      let panel = container.querySelector('[data-testid="focus-panel"]') as HTMLElement
      expect(panel.dataset.focusPhase).toBe('ready')
      expect(container.textContent).toContain(en.focusCompanion.ready)

      const buttons = [...container.querySelectorAll('button')]
      const confirm = buttons.find((b) => b.textContent?.includes(en.focusCompanion.confirmCheckIn))
      expect(confirm).toBeTruthy()
      expect(buttons.some((b) => b.textContent?.includes(en.focusCompanion.extendFive))).toBe(true)
      expect(
        buttons.some(
          (b) =>
            b.textContent?.includes(en.focusCompanion.giveUp) ||
            b.getAttribute('aria-label') === en.focusCompanion.giveUp,
        ),
      ).toBe(true)

      act(() => confirm!.click())
      expect(useAppStore.getState().checkIns.some((c) => c.habitId === 'h2' && c.date === '2026-09-30')).toBe(true)
      expect(useTimerStore.getState().sessions.h2).toBeUndefined()
      expect(localStorage.getItem(FOCUS_SESSIONS_STORAGE_KEY)).toBeNull()

      // 回到日常形态（待办里 h2 已完成，只剩全待办状态/进度）
      panel = container.querySelector('[data-testid="focus-panel"]') as HTMLElement
      expect(panel).toBeNull()
      act(() => root.unmount())
    })

    it('再等 5 分钟：延长后回到 focusing，extensions 持久化，且上限 2 次后按钮消失', () => {
      act(() => {
        useTimerStore.setState({
          sessions: { h2: { startedAt: Date.now() - 26 * MINUTE, targetMs: 25 * MINUTE } },
        })
      })
      const root = renderToy('standard')
      const findExtend = () =>
        [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(en.focusCompanion.extendFive))

      act(() => findExtend()!.click())
      expect(useTimerStore.getState().sessions.h2.extensions).toBe(1)
      let panel = container.querySelector('[data-testid="focus-panel"]') as HTMLElement
      expect(panel.dataset.focusPhase).toBe('focusing')

      // 再次到点 → 再延长一次（上限 2 次）
      act(() => {
        useTimerStore.setState({
          sessions: { h2: { ...useTimerStore.getState().sessions.h2, startedAt: Date.now() - 31 * MINUTE } },
        })
      })
      act(() => findExtend()!.click())
      expect(useTimerStore.getState().sessions.h2.extensions).toBe(2)
      act(() => {
        useTimerStore.setState({
          sessions: { h2: { ...useTimerStore.getState().sessions.h2, startedAt: Date.now() - 36 * MINUTE, targetMs: 25 * MINUTE } },
        })
      })
      panel = container.querySelector('[data-testid="focus-panel"]') as HTMLElement
      expect(panel.dataset.focusPhase).toBe('ready')
      expect(findExtend()).toBeUndefined() // 已达上限，不再提供延长
      act(() => root.unmount())
    })

    it('放弃：二次确认后清除会话，且不产生任何打卡', () => {
      act(() => {
        useTimerStore.setState({
          sessions: { h2: { startedAt: Date.now() - 26 * MINUTE, targetMs: 25 * MINUTE } },
        })
      })
      const before = useAppStore.getState().checkIns.length
      const root = renderToy('standard')
      const findGiveUp = () =>
        [...container.querySelectorAll('button')].find(
          (b) =>
            b.textContent?.includes(en.focusCompanion.giveUp) ||
            b.getAttribute('aria-label') === en.focusCompanion.giveUp,
        )

      act(() => findGiveUp()!.click())
      expect(container.textContent).toContain(en.focusCompanion.giveUpConfirm)

      const confirmBtn = [...container.querySelectorAll('button')].find((b) =>
        b.textContent?.includes(en.focusCompanion.giveUp),
      )
      act(() => confirmBtn!.click())
      expect(useTimerStore.getState().sessions.h2).toBeUndefined()
      expect(useAppStore.getState().checkIns.length).toBe(before)
      expect(container.textContent).not.toContain(en.focusCompanion.giveUpConfirm)
      act(() => root.unmount())
    })

    it('重开恢复：从 localStorage 恢复已到点会话 → 直接 ready（不自动打卡）', () => {
      localStorage.setItem(
        FOCUS_SESSIONS_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          sessions: { h2: { startedAt: Date.now() - 40 * MINUTE, targetMs: 25 * MINUTE } },
        }),
      )
      useTimerStore.setState({ sessions: readFocusSessions() })
      const checkInsBefore = useAppStore.getState().checkIns.length

      const root = renderToy('display')
      const panel = container.querySelector('[data-testid="focus-panel"]') as HTMLElement
      expect(panel.dataset.focusPhase).toBe('ready')
      expect(useAppStore.getState().checkIns.length).toBe(checkInsBefore) // 不自动完成
      act(() => root.unmount())
    })
  })

})
