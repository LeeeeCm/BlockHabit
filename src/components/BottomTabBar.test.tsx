import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { BottomTabBar } from './BottomTabBar'
import * as platform from '../platform'

function render(ui: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(ui)
  })
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
    getByTestId: (testId: string) => {
      const el = container.querySelector(`[data-testid="${testId}"]`)
      if (!el) throw new Error(`Element with data-testid="${testId}" not found`)
      return el as HTMLElement
    },
    queryByTestId: (testId: string) => {
      return container.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null
    },
  }
}

describe('BottomTabBar component', () => {
  let hapticSpy: MockInstance

  beforeEach(() => {
    vi.restoreAllMocks()
    hapticSpy = vi.spyOn(platform, 'triggerHaptic').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders all 4 navigation tabs (today, build, showcase, stats)', () => {
    const onChange = vi.fn()
    const { getByTestId, unmount } = render(
      <BottomTabBar currentTab="today" onChange={onChange} />
    )

    expect(getByTestId('tab-today')).toBeDefined()
    expect(getByTestId('tab-build')).toBeDefined()
    expect(getByTestId('tab-showcase')).toBeDefined()
    expect(getByTestId('tab-stats')).toBeDefined()

    unmount()
  })

  it('triggers onChange and haptic feedback when an inactive tab is clicked', () => {
    const onChange = vi.fn()
    const { getByTestId, unmount } = render(
      <BottomTabBar currentTab="today" onChange={onChange} />
    )

    const buildTab = getByTestId('tab-build')
    act(() => {
      buildTab.click()
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('build')
    expect(hapticSpy).toHaveBeenCalledWith('light')

    unmount()
  })

  it('does not trigger onChange or haptic feedback when the active tab is clicked', () => {
    const onChange = vi.fn()
    const { getByTestId, unmount } = render(
      <BottomTabBar currentTab="today" onChange={onChange} />
    )

    const todayTab = getByTestId('tab-today')
    act(() => {
      todayTab.click()
    })

    expect(onChange).not.toHaveBeenCalled()
    expect(hapticSpy).not.toHaveBeenCalled()

    unmount()
  })

  it('verifies active indicator matches current tab', () => {
    const onChange = vi.fn()
    const { getByTestId, queryByTestId, unmount } = render(
      <BottomTabBar currentTab="showcase" onChange={onChange} />
    )

    const showcaseTab = getByTestId('tab-showcase')
    expect(showcaseTab.getAttribute('data-active')).toBe('true')
    expect(showcaseTab.classList.contains('active')).toBe(true)
    expect(getByTestId('indicator-showcase')).toBeDefined()

    const todayTab = getByTestId('tab-today')
    expect(todayTab.getAttribute('data-active')).toBe('false')
    expect(queryByTestId('indicator-today')).toBeNull()

    unmount()
  })

  it('verifies badge for unfinished today habits', () => {
    const onChange = vi.fn()
    const { getByTestId, unmount: unmount1 } = render(
      <BottomTabBar currentTab="today" onChange={onChange} hasUnfinishedToday={true} />
    )
    expect(getByTestId('badge-unfinished-today')).toBeDefined()
    unmount1()

    const { queryByTestId: queryNoBadge, unmount: unmount2 } = render(
      <BottomTabBar currentTab="today" onChange={onChange} hasUnfinishedToday={false} />
    )
    expect(queryNoBadge('badge-unfinished-today')).toBeNull()
    unmount2()
  })

  it('verifies badge for build progress percent', () => {
    const onChange = vi.fn()
    const { getByTestId, unmount: unmount1 } = render(
      <BottomTabBar currentTab="today" onChange={onChange} buildProgressPercent={75} />
    )
    const badge = getByTestId('badge-build-progress')
    expect(badge).toBeDefined()
    expect(badge.textContent).toBe('75%')
    unmount1()

    const { queryByTestId: queryNoProgress, unmount: unmount2 } = render(
      <BottomTabBar currentTab="today" onChange={onChange} buildProgressPercent={0} />
    )
    expect(queryNoProgress('badge-build-progress')).toBeNull()
    unmount2()
  })
})
