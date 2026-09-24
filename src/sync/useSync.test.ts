import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSync, loadWebDavConfig, saveWebDavConfig } from './useSync'
import { useAppStore } from '../store/appStore'

function renderHookHelper<T>(useHook: () => T) {
  const result: { current: T } = { current: null as unknown as T }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  function TestComponent() {
    const value = useHook()
    result.current = value
    return null
  }

  act(() => {
    root.render(React.createElement(TestComponent))
  })

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe('useSync hook', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('loads default config when storage is empty', () => {
    const config = loadWebDavConfig()
    expect(config.endpoint).toBe('')
    expect(config.username).toBe('')
    expect(config.password).toBe('')
    expect(config.enabled).toBe(false)
  })

  it('saves and loads config correctly', () => {
    const sample = {
      endpoint: 'https://dav.test/webdav',
      username: 'alice',
      password: 'password123',
      enabled: true,
      autoSyncIntervalMinutes: 15,
      lastSyncAt: null,
      lastSyncStatus: 'idle' as const,
      lastSyncError: null,
    }
    saveWebDavConfig(sample)
    expect(loadWebDavConfig()).toEqual(sample)
  })

  it('syncNow fails if endpoint is empty', async () => {
    const { result, unmount } = renderHookHelper(() => useSync())

    let ok = false
    await act(async () => {
      ok = await result.current.syncNow()
    })

    expect(ok).toBe(false)
    expect(result.current.status).toBe('error')
    expect(result.current.error).toContain('请先填写 WebDAV 服务器地址')
    unmount()
  })

  it('syncNow pushes local data when remote returns 404', async () => {
    saveWebDavConfig({
      endpoint: 'https://dav.test/dav/',
      username: 'user',
      password: 'pwd',
      enabled: true,
    })

    // Mock fetch: GET -> 404, PUT -> 201
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method === 'GET') {
        return new Response(null, { status: 404, statusText: 'Not Found' })
      }
      if (init?.method === 'PUT') {
        return new Response(null, { status: 201, statusText: 'Created' })
      }
      return new Response(null, { status: 400 })
    })

    const { result, unmount } = renderHookHelper(() => useSync())

    let ok = false
    await act(async () => {
      ok = await result.current.syncNow()
    })

    expect(ok).toBe(true)
    expect(result.current.status).toBe('success')
    expect(result.current.error).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    unmount()
  })

  it('syncNow merges remote and local data and updates app store', async () => {
    saveWebDavConfig({
      endpoint: 'https://dav.test/dav/',
      username: 'user',
      password: 'pwd',
      enabled: true,
    })

    const remoteState = {
      schemaVersion: 1,
      habits: [
        {
          id: 'remote-h1',
          name: 'Remote Habit',
          frequency: { type: 'daily' },
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      checkIns: [],
      builds: [],
      activeBlueprintId: 'plant',
      completedBlueprintIds: ['remote-bp'],
      settings: { theme: 'light', language: 'zh' },
      dayClaims: [],
      repairBricks: 1,
    }

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method === 'GET') {
        return new Response(JSON.stringify(remoteState), { status: 200, statusText: 'OK' })
      }
      if (init?.method === 'PUT') {
        return new Response(null, { status: 204, statusText: 'No Content' })
      }
      return new Response(null, { status: 400 })
    })

    const { result, unmount } = renderHookHelper(() => useSync())

    let ok = false
    await act(async () => {
      ok = await result.current.syncNow()
    })

    expect(ok).toBe(true)
    expect(result.current.status).toBe('success')
    // Check that store has the remote habit
    const currentHabits = useAppStore.getState().habits
    expect(currentHabits.some((h) => h.id === 'remote-h1')).toBe(true)
    unmount()
  })
})
