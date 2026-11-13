import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSync, loadWebDavConfig, saveWebDavConfig } from './useSync'
import { useAppStore } from '../store/appStore'
import { CONTENT_VERSION } from '../logic/blueprints/manifest'

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
    }
  }
}

describe('useSync hook', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    // 同步前置条件：已完成磁盘加载（syncNow 对未 hydrated 状态直接拒绝）
    useAppStore.setState({ hydrated: true })
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
      lastSyncError: null
    }
    saveWebDavConfig(sample)
    // B1：新字段 rememberPassword 缺省为 true（旧配置兼容）
    expect(loadWebDavConfig()).toEqual({ ...sample, rememberPassword: true })
  })

  it('syncNow fails if endpoint is empty', async () => {
    const { result, unmount } = renderHookHelper(() => useSync())

    let ok = false
    await act(async () => {
      ok = await result.current.syncNow()
    })

    expect(ok).toBe(false)
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('no-endpoint')
    unmount()
  })

  it('syncNow refuses to run before store hydration', async () => {
    // 预设合法端点：确保失败原因是 hydrated 守卫而非端点校验
    saveWebDavConfig({
      endpoint: 'https://dav.test/dav/',
      username: 'user',
      password: 'pwd',
      enabled: false
    })
    useAppStore.setState({ hydrated: false })
    const { result, unmount } = renderHookHelper(() => useSync())

    let ok = true
    await act(async () => {
      ok = await result.current.syncNow()
    })

    expect(ok).toBe(false)
    // hydrated 守卫静默拒绝：状态不变、无错误码
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
    unmount()
    useAppStore.setState({ hydrated: true })
  })

  it('syncNow pushes local data when remote returns 404', async () => {
    saveWebDavConfig({
      endpoint: 'https://dav.test/dav/',
      username: 'user',
      password: 'pwd',
      enabled: true
    })

    // Mock fetch: GET -> 404, PROPFIND -> 207 (目录存在、文件不存在), PUT -> 201
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method === 'GET') {
        return new Response(null, { status: 404, statusText: 'Not Found' })
      }
      if (init?.method === 'PROPFIND') {
        return new Response(null, { status: 207, statusText: 'Multi-Status' })
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
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    unmount()
  })

  it('syncNow merges remote and local data and updates app store', async () => {
    saveWebDavConfig({
      endpoint: 'https://dav.test/dav/',
      username: 'user',
      password: 'pwd',
      enabled: true
    })

    const remoteState = {
      schemaVersion: 1,
      habits: [
        {
          id: 'remote-h1',
          name: 'Remote Habit',
          frequency: { type: 'daily' },
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ],
      checkIns: [],
      builds: [],
      activeBlueprintId: 'plant',
      // 必须是真实蓝图 id：存档校验现在会拒绝未知外键（见 A3 / adapter.blueprint.test.ts）
      completedBlueprintIds: ['castle'],
      settings: { theme: 'light', language: 'zh' },
      dayClaims: [],
      repairBricks: 1
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

  it('syncNow re-merges and re-pushes after a 412 conditional-write conflict', async () => {
    saveWebDavConfig({
      endpoint: 'https://dav.test/dav/',
      username: 'user',
      password: 'pwd',
      enabled: true
    })
    // 本地已有习惯
    useAppStore.setState({
      habits: [
        {
          id: 'local-h1',
          name: 'Local',
          frequency: { type: 'daily' },
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ]
    })

    const remote1 = {
      schemaVersion: 2,
      habits: [],
      checkIns: [],
      builds: [],
      activeBlueprintId: 'plant',
      completedBlueprintIds: [],
      settings: { theme: 'light', language: 'zh' },
      dayClaims: []
    }
    const remote2 = {
      schemaVersion: 2,
      habits: [
        {
          id: 'remote-h2',
          name: 'Concurrent',
          frequency: { type: 'daily' },
          createdAt: '2026-01-02T00:00:00.000Z'
        }
      ],
      checkIns: [],
      builds: [],
      activeBlueprintId: 'plant',
      completedBlueprintIds: [],
      settings: { theme: 'light', language: 'zh' },
      dayClaims: []
    }

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(remote1), { status: 200, headers: { ETag: '"e1"' } })
      )
      .mockResolvedValueOnce(new Response(null, { status: 412 })) // 第一次 PUT 条件写失败
      .mockResolvedValueOnce(
        new Response(JSON.stringify(remote2), { status: 200, headers: { ETag: '"e2"' } })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 })) // 重试 PUT 成功

    const { result, unmount } = renderHookHelper(() => useSync())
    let ok = false
    await act(async () => {
      ok = await result.current.syncNow()
    })

    expect(ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(4)
    // 合并结果同时包含本地与并发远端的习惯
    const habits = useAppStore.getState().habits
    expect(habits.some((h) => h.id === 'local-h1')).toBe(true)
    expect(habits.some((h) => h.id === 'remote-h2')).toBe(true)
    unmount()
  })

  it('syncNow reports conflict error when 412 persists after retry', async () => {
    saveWebDavConfig({
      endpoint: 'https://dav.test/dav/',
      username: 'user',
      password: 'pwd',
      enabled: true
    })
    const remote = {
      schemaVersion: 2,
      habits: [],
      checkIns: [],
      builds: [],
      activeBlueprintId: 'plant',
      completedBlueprintIds: [],
      settings: { theme: 'light', language: 'zh' },
      dayClaims: []
    }
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(remote), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 412 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(remote), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 412 }))

    const { result, unmount } = renderHookHelper(() => useSync())
    let ok = true
    await act(async () => {
      ok = await result.current.syncNow()
    })
    expect(ok).toBe(false)
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('conflict')
    unmount()
  })

  it('syncNow reports parse error on corrupted remote archive', async () => {
    saveWebDavConfig({
      endpoint: 'https://dav.test/dav/',
      username: 'user',
      password: 'pwd',
      enabled: true
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{oops-not-json', { status: 200 })
    )

    const { result, unmount } = renderHookHelper(() => useSync())
    let ok = true
    await act(async () => {
      ok = await result.current.syncNow()
    })
    expect(ok).toBe(false)
    expect(result.current.error).toBe('parse')
    unmount()
  })
  it('拒绝更高内容版本的远端存档，且不写坏远端（B1 兼容矩阵）', async () => {
    saveWebDavConfig({
      endpoint: 'https://dav.test/dav/',
      username: 'user',
      password: 'pwd',
      enabled: true
    })
    const remoteFuture = {
      schemaVersion: 2,
      // B1：必须以「当前内容版本 + 1」构造未来档，否则内容包升级后该用例会失效
      contentVersion: CONTENT_VERSION + 1,
      habits: [],
      checkIns: [],
      builds: [],
      activeBlueprintId: 'plant',
      completedBlueprintIds: [],
      settings: { theme: 'light', language: 'zh' },
      dayClaims: []
    }
    let putCalls = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method === 'GET') return new Response(JSON.stringify(remoteFuture), { status: 200 })
      if (init?.method === 'PUT') {
        putCalls++
        return new Response(null, { status: 204 })
      }
      return new Response(null, { status: 400 })
    })
    const { result, unmount } = renderHookHelper(() => useSync())
    let ok = true
    await act(async () => {
      ok = await result.current.syncNow()
    })
    expect(ok).toBe(false)
    expect(result.current.error).toBe('incompatible')
    expect(putCalls).toBe(0)
    unmount()
  })
})
