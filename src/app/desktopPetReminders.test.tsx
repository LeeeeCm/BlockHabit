import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../store/appStore'
import { useReminderStore } from '../store/reminderStore'
import { useTimerStore } from '../store/timerStore'
import { TimerWatcher } from './TimerWatcher'
import { ReminderWatcher } from '../components/ReminderWatcher'
import { notify } from '../platform/notify'
import type { Habit } from '../types'

vi.mock('../platform/notify', () => ({ notify: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../audio/sound', () => ({ playReminderChime: vi.fn() }))

const focus: Habit = {
  id: 'focus',
  name: 'Read',
  createdAt: '2026-11-01',
  kind: 'focus',
  frequency: { type: 'daily' },
  targetMinutes: 5
}
const scheduled: Habit = {
  id: 'water',
  name: 'Water',
  createdAt: '2026-11-01',
  frequency: { type: 'daily' },
  reminder: { start: '09:00', end: '10:00' }
}
let root: ReturnType<typeof createRoot>
let node: HTMLDivElement

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 24, 9, 1))
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  useAppStore.setState({ habits: [focus, scheduled], checkIns: [], reminderLog: {} })
  useReminderStore.setState({ tracks: {}, pending: [], suppressed: false })
  useTimerStore.setState({ sessions: {} })
  node = document.createElement('div')
  document.body.append(node)
  root = createRoot(node)
})

afterEach(() => {
  act(() => root.unmount())
  node.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('desktop pet reminder delivery', () => {
  it('queues one visible-pet reminder without also sending a notification or writing a check-in', () => {
    act(() => root.render(<ReminderWatcher preferPet />))
    expect(useReminderStore.getState().pending.map(({ habitId }) => habitId)).toEqual(['water'])
    expect(notify).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(useReminderStore.getState().pending).toHaveLength(1)
    expect(useAppStore.getState().checkIns).toEqual([])
  })

  it('retains a single system notification when a pet window is hidden', () => {
    vi.mocked(Object.getOwnPropertyDescriptor(document, 'visibilityState')?.get)?.mockReturnValue(
      'hidden'
    )
    useTimerStore.setState({
      sessions: { focus: { startedAt: Date.now() - 300_000, targetMs: 300_000 } }
    })
    act(() => root.render(<TimerWatcher preferPet />))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(useTimerStore.getState().sessions.focus.notifiedAt).toBeDefined()
    expect(useAppStore.getState().checkIns).toEqual([])
  })

  it('dedupes focus notifications when switching from the visible pet back to the main window', () => {
    useTimerStore.setState({
      sessions: { focus: { startedAt: Date.now() - 300_000, targetMs: 300_000 } }
    })
    act(() => root.render(<TimerWatcher preferPet />))
    expect(notify).not.toHaveBeenCalled()
    expect(useTimerStore.getState().sessions.focus.notifiedAt).toBeDefined()
    act(() => root.render(<TimerWatcher />))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(notify).not.toHaveBeenCalled()
  })
})
