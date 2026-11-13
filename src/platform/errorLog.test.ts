import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  APP_VERSION,
  CRASH_LOG_KEY,
  CRASH_LOG_LIMIT,
  buildDiagnosticsText,
  clearCrashLog,
  downloadDiagnostics,
  getCrashLog,
  installGlobalErrorHandlers,
  recordCrash
} from './errorLog'

describe('errorLog 本地崩溃日志', () => {
  beforeEach(() => {
    clearCrashLog()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    clearCrashLog()
  })

  it('keeps at most 30 entries and drops the oldest ones', () => {
    for (let i = 0; i < CRASH_LOG_LIMIT + 5; i += 1) {
      recordCrash('error', new Error(`boom-${i}`))
    }

    const entries = getCrashLog()
    expect(entries).toHaveLength(CRASH_LOG_LIMIT)
    expect(entries[0].message).toBe('boom-5')
    expect(entries[CRASH_LOG_LIMIT - 1].message).toBe(`boom-${CRASH_LOG_LIMIT + 4}`)

    // 持久化同样只保留最近 30 条
    const persisted = JSON.parse(localStorage.getItem(CRASH_LOG_KEY) ?? '[]') as unknown[]
    expect(persisted).toHaveLength(CRASH_LOG_LIMIT)
  })

  it('normalizes error kinds, messages and stacks', () => {
    recordCrash('render', new Error('render failed'))
    recordCrash('rejection', 'plain string reason', 'fallback')
    recordCrash('error', { message: 'event-like message', stack: 'fake stack' })

    const entries = getCrashLog()
    expect(entries.map((entry) => entry.kind)).toEqual(['render', 'rejection', 'error'])
    expect(entries[1].message).toBe('plain string reason')
    expect(entries[2].message).toBe('event-like message')
    expect(entries[0].stack).toContain('render failed')
  })

  it('does not throw when localStorage writes fail', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => recordCrash('render', new Error('storage is full'))).not.toThrow()
    // 写入失败时日志仍保留在内存中
    expect(getCrashLog()).toHaveLength(1)
    expect(getCrashLog()[0].message).toBe('storage is full')
  })

  it('survives corrupt persisted JSON and hydrates valid history', () => {
    localStorage.setItem(CRASH_LOG_KEY, 'not-json{{{')
    expect(() => getCrashLog()).not.toThrow()
    expect(getCrashLog()).toEqual([])

    clearCrashLog()
    localStorage.setItem(
      CRASH_LOG_KEY,
      JSON.stringify([{ at: '2026-11-10T00:00:00.000Z', kind: 'error', message: 'persisted boom' }])
    )
    const hydrated = getCrashLog()
    expect(hydrated).toHaveLength(1)
    expect(hydrated[0].message).toBe('persisted boom')
  })

  it('builds diagnostics text with app version, UA and crash entries', () => {
    recordCrash('rejection', new Error('promise exploded'), undefined, 'at App.tsx:1:1')

    const text = buildDiagnosticsText(new Date('2026-11-10T01:42:15.000Z'))
    expect(text).toContain('BlockHabit Diagnostics')
    expect(text).toContain(APP_VERSION)
    expect(text).toMatch(/App version: \d+\.\d+\.\d+/)
    expect(text).toContain(navigator.userAgent)
    expect(text).toContain('Generated at: 2026-11-10T01:42:15.000Z')
    expect(text).toContain('promise exploded')
    expect(text).toContain('at App.tsx:1:1')
    expect(text).toContain('No data was uploaded')
  })

  it('exports diagnostics as a local text download without network requests', async () => {
    recordCrash('error', new Error('download me'))

    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:blockhabit-diagnostics')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL
    })

    let downloadedFileName = ''
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloadedFileName = this.download
    })

    try {
      downloadDiagnostics()

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      const blob = createObjectURL.mock.calls[0][0]
      expect(blob.size).toBeGreaterThan(0)
      expect(clickSpy).toHaveBeenCalledTimes(1)
      expect(downloadedFileName).toMatch(/^blockhabit-diagnostics-.+\.txt$/)
      expect(fetchSpy).not.toHaveBeenCalled()

      // 临时 <a> 用后即移除，不污染 DOM
      expect(document.querySelector('a[download^="blockhabit-diagnostics-"]')).toBeNull()

      // 等撤销定时器跑完，URL 被回收
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:blockhabit-diagnostics')
    } finally {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL
      })
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL
      })
    }
  })

  it('captures window.onerror and unhandledrejection via global handlers', () => {
    const cleanup = installGlobalErrorHandlers()

    const errorEvent = new Event('error') as Event & {
      message?: string
      error?: unknown
      filename?: string
      lineno?: number
      colno?: number
    }
    errorEvent.message = 'global boom'
    errorEvent.error = new Error('global boom')
    errorEvent.filename = 'app.js'
    errorEvent.lineno = 3
    errorEvent.colno = 7
    window.dispatchEvent(errorEvent)

    const rejectionEvent = new Event('unhandledrejection') as Event & { reason?: unknown }
    rejectionEvent.reason = new Error('rejected boom')
    window.dispatchEvent(rejectionEvent)

    const entries = getCrashLog()
    expect(entries.some((entry) => entry.kind === 'error' && entry.message === 'global boom')).toBe(
      true
    )
    expect(
      entries.some((entry) => entry.kind === 'rejection' && entry.message === 'rejected boom')
    ).toBe(true)
    expect(entries.find((entry) => entry.kind === 'error')?.stack).toContain('app.js:3:7')

    cleanup()
    const countAfterCleanup = getCrashLog().length
    // 卸载后不再记录；这里用不带 error 的事件，避免触发 Vitest 对「无人监听的 error 事件」的未捕获异常上报
    const ignoredEvent = new Event('error')
    window.dispatchEvent(ignoredEvent)
    expect(getCrashLog()).toHaveLength(countAfterCleanup)
  })
})
