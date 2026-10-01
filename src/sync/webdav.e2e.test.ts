import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fetchRemoteState, pushRemoteState, WebDavError } from './webdav'
import { mergeAppState } from './merge'
import { prepareImport } from '../storage/adapter'
import type { WebDavConfig } from './types'
import type { AppState, CheckIn, Habit } from '../types'

/**
 * WebDAV 双设备端到端模拟（手工验证清单的自动化替代）：
 * 真实本地 HTTP 服务器模拟 WebDAV 语义（GET/PUT + If-Match/PROPFIND/MKCOL），
 * 验证"双设备撤销不复活 / 并发推送 412 收敛 / 首次同步"三条核心场景。
 */

const FILE = '/dav/blockhabit-data.json'
let server: Server
let port = 0
/** 模拟云端对象存储 */
const cloud = new Map<string, { body: string; etag: string }>()
let etagCounter = 0
/** 并发写注入器：PUT 收到过期 If-Match 时，先写入"另一台设备"的数据再返回 412 */
let concurrentWriter: ((current: { body: string; etag: string } | undefined) => void) | null = null

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = req.url ?? ''
    if (req.method === 'PROPFIND') {
      res.statusCode = 207
      res.end()
      return
    }
    if (req.method === 'MKCOL') {
      res.statusCode = 201
      res.end()
      return
    }
    if (!url.endsWith('blockhabit-data.json')) {
      res.statusCode = 404
      res.end()
      return
    }
    if (req.method === 'GET') {
      const obj = cloud.get(FILE)
      if (!obj) {
        res.statusCode = 404
        res.end()
        return
      }
      res.writeHead(200, { ETag: obj.etag })
      res.end(obj.body)
      return
    }
    if (req.method === 'PUT') {
      // 先完整排干请求体再做判定/响应——提前响应会让 undici 端悬挂
      const chunks: Buffer[] = []
      req.on('data', (c) => chunks.push(c as Buffer))
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8')
        const ifMatch = req.headers['if-match'] as string | undefined
        const current = cloud.get(FILE)
        if (ifMatch && current && ifMatch !== current.etag) {
          // 模拟并发写：另一台设备已抢先更新云端
          concurrentWriter?.(current)
          res.statusCode = 412
          res.end()
          return
        }
        const etag = `"e${++etagCounter}"`
        cloud.set(FILE, { etag, body })
        res.statusCode = 204
        res.end()
      })
      return
    }
    res.statusCode = 405
    res.end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  port = (server.address() as AddressInfo).port
})

afterAll(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

const config: WebDavConfig = {
  endpoint: '',
  username: 'tester',
  password: 'secret',
  enabled: true,
}

function habit(id: string, name: string, updatedAt: string): Habit {
  return { id, name, frequency: { type: 'daily' }, createdAt: '2026-08-01T00:00:00.000Z', updatedAt }
}

function checkIn(id: string, habitId: string, date: string, at: string, placedBlockId?: string, deletedAt?: string): CheckIn {
  return { id, habitId, date, at, placedBlockId, blueprintId: 'plant', deletedAt }
}

function v2State(overrides: Partial<AppState>): AppState {
  return {
    schemaVersion: 2,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' },
    dayClaims: [],
    deletedDayClaims: [],
    repairBricks: 0,
    showcasePlacements: [],
    foundationNotes: {},
    ...overrides,
  }
}

describe('WebDAV E2E: two-device sync against a real local server', () => {
  it('first sync: remote empty collection → push local', async () => {
    const cfg = { ...config, endpoint: `http://127.0.0.1:${port}/dav/` }
    const remote = await fetchRemoteState(cfg)
    expect(remote.json).toBeNull() // GET 404 + PROPFIND 207 确认
    await pushRemoteState(cfg, JSON.stringify(v2State({})), remote.etag)
    expect(cloud.get(FILE)?.body).toContain('"schemaVersion":2')
  })

  it('device A undo is not resurrected when device B merges (tombstone wins)', async () => {
    const cfg = { ...config, endpoint: `http://127.0.0.1:${port}/dav/` }
    const daysAgo = (n: number) => {
      const d = new Date(Date.now() - n * 86_400_000)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const h = habit('h-run', '跑步', '2026-08-01T00:00:00.000Z')

    // 设备 B 的本地视图：打卡已被撤销（墓碑），积木已回收
    const deviceB: AppState = v2State({
      habits: [h],
      checkIns: [checkIn('c1', 'h-run', daysAgo(1), new Date(Date.now() - 86_400_000).toISOString(), 'b0', new Date().toISOString())],
      dayClaims: [],
    })
    expect(deviceB.builds).toHaveLength(0)

    // 设备 A 的档案：仍有这条有效打卡（尚未看到撤销）
    const deviceA = v2State({
      habits: [h],
      checkIns: [checkIn('c1', 'h-run', daysAgo(1), new Date(Date.now() - 86_400_000).toISOString(), 'b0')],
      dayClaims: [],
    })
    await pushRemoteState(cfg, JSON.stringify(deviceA))

    // 设备 B 拉取 → 合并 → 投影
    const remote = await fetchRemoteState(cfg)
    const prepared = prepareImport(JSON.parse(remote.json!))
    expect(prepared).not.toBeNull()
    const merged = mergeAppState(deviceB, prepared!)
    const c1 = merged.checkIns.find((c) => c.id === 'c1')!
    expect(c1.deletedAt).toBeDefined()
    expect(merged.builds.filter((b) => b.id === 'b0')).toHaveLength(0)

    // B 推回合并结果；A 再拉取 → 撤销已同步，不会复活
    await pushRemoteState(cfg, JSON.stringify(merged), remote.etag)
    const remote2 = await fetchRemoteState(cfg)
    const backOnA = mergeAppState(deviceA, prepareImport(JSON.parse(remote2.json!))!)
    expect(backOnA.checkIns.find((c) => c.id === 'c1')!.deletedAt).toBeDefined()
    expect(backOnA.builds.filter((b) => b.id === 'b0')).toHaveLength(0)
  })

  it('concurrent push: stale If-Match gets 412 and retry converges (no lost update)', async () => {
    const cfg = { ...config, endpoint: `http://127.0.0.1:${port}/dav/` }

    // 云端已有设备 A 的档案（etag e1）
    const archiveA = v2State({
      habits: [habit('h-a', '设备A习惯', '2026-08-01T00:00:00.000Z')],
    })
    await pushRemoteState(cfg, JSON.stringify(archiveA))
    const snapshot1 = await fetchRemoteState(cfg)
    expect(snapshot1.etag).toBeDefined()

    // 设备 B 基于陈旧视图推送；服务器在 412 前注入"设备 A 刚推送的新版本"
    const deviceBLocal = v2State({
      habits: [habit('h-b', '设备B习惯', '2026-08-01T00:00:00.000Z')],
    })
    concurrentWriter = () => {
      const parsed = JSON.parse(cloud.get(FILE)!.body)
      const prepared = prepareImport(parsed)
      if (!prepared) throw new Error('concurrent writer: prepareImport returned null')
      const newer = mergeAppState(prepared, archiveA)
      cloud.set(FILE, {
        etag: `"e${++etagCounter}"`,
        body: JSON.stringify({ ...newer, habits: [...newer.habits, habit('h-c', '设备C习惯', '2026-08-02T00:00:00.000Z')] }),
      })
    }

    const stale = await fetchRemoteState(cfg)
    console.log('step: stale fetched, etag=', stale.etag)
    vi.spyOn(globalThis, 'fetch')
    let sawConflict = false
    try {      // 直接用陈旧 etag 复现 412（绕过 fetch 内部流程）
      const merged = mergeAppState(deviceBLocal, prepareImport(JSON.parse(stale.json!))!)
      await pushRemoteState(cfg, JSON.stringify(merged), `"stale-etag"`)
    } catch (err) {
      expect(err).toBeInstanceOf(WebDavError)
      expect((err as WebDavError).code).toBe('conflict')
      sawConflict = true
    }
    console.log('step: conflict observed =', sawConflict)
    expect(sawConflict).toBe(true)

    // B 按 useSync 的重试语义：重拉 → 重并 → 用新 etag 再推
    const retry = await fetchRemoteState(cfg)
    console.log('step: retry fetched, etag=', retry.etag)
    const remerged = mergeAppState(deviceBLocal, prepareImport(JSON.parse(retry.json!))!)
    await pushRemoteState(cfg, JSON.stringify(remerged), retry.etag)
    const final = await fetchRemoteState(cfg)
    const finalState = prepareImport(JSON.parse(final.json!))!
    const names = finalState.habits.map((h) => h.name).sort()
    expect(names).toEqual(['设备A习惯', '设备B习惯', '设备C习惯'])
    vi.restoreAllMocks()
  })
})
