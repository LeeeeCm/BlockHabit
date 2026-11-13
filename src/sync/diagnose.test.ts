import { describe, it, expect } from 'vitest'
import {
  DIAGNOSE_TIMEOUT_MS,
  TEMP_FILE_SUFFIX,
  classifyTransportError,
  createFetchTransport,
  makeTempFileName,
  normalizeCollectionUrl,
  runWebDavDiagnosis,
  sanitizeDiagnosticDetail,
  type DiagnoseRequestInit,
  type DiagnoseResponse,
  type DiagnoseTransport
} from './diagnose'

const STAGES = ['address', 'connection', 'auth', 'readwrite', 'cleanup'] as const

const PASSWORD = 'secret-password'
const BASE_OPTIONS = {
  endpoint: 'https://dav.example.com/dav/',
  username: 'alice',
  password: PASSWORD
}

type Step =
  DiagnoseResponse | Error | ((url: string, init: DiagnoseRequestInit) => DiagnoseResponse)

interface RecordedCall {
  url: string
  init: DiagnoseRequestInit
}

function response(status: number, text?: string): DiagnoseResponse {
  return { status, ok: status >= 200 && status < 300, text }
}

function makeTransport(steps: Step[]): { transport: DiagnoseTransport; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  let index = 0
  const transport: DiagnoseTransport = async (url, init) => {
    calls.push({ url, init })
    const step = index < steps.length ? steps[index] : steps[steps.length - 1]
    index += 1
    if (step instanceof Error) throw step
    if (typeof step === 'function') return step(url, init)
    return step
  }
  return { transport, calls }
}

/** 成功链路：connection 207 → auth 207 → PUT 201 → GET 读回 → DELETE 204 */
async function runSuccess(overrides: Partial<typeof BASE_OPTIONS> = {}) {
  let putBody: string | undefined
  const harness = makeTransport([
    response(207),
    response(207),
    (_url, init) => {
      putBody = init.body
      return response(201)
    },
    () => response(200, putBody),
    response(204)
  ])
  const result = await runWebDavDiagnosis({
    ...BASE_OPTIONS,
    ...overrides,
    transport: harness.transport
  })
  return { ...harness, result }
}

describe('diagnose：WebDAV 分步连接自检', () => {
  it('全部通过：五个阶段、顺序正确、临时文件 PUT→GET→DELETE 同一 URL', async () => {
    const { calls, result } = await runSuccess()

    expect(result.ok).toBe(true)
    expect(result.stages.map((stage) => stage.stage)).toEqual([...STAGES])
    expect(result.stages.every((stage) => stage.ok)).toBe(true)
    expect(result.stages.map((stage) => stage.code)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok'])
    expect(typeof result.elapsedMs).toBe('number')
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0)

    expect(calls).toHaveLength(5)
    // connection：无凭据的 PROPFIND Depth:0
    expect(calls[0].url).toBe('https://dav.example.com/dav/')
    expect(calls[0].init.method).toBe('PROPFIND')
    expect(calls[0].init.headers?.Depth).toBe('0')
    expect(calls[0].init.headers?.Authorization).toBeUndefined()
    // auth：带 Basic 的 PROPFIND
    expect(calls[1].init.method).toBe('PROPFIND')
    expect(calls[1].init.headers?.Authorization).toMatch(/^Basic /)
    // 临时文件：同一个 URL 被 PUT → GET → DELETE
    const tempUrl = calls[2].url
    expect(tempUrl.startsWith('https://dav.example.com/dav/')).toBe(true)
    expect(tempUrl.endsWith(TEMP_FILE_SUFFIX)).toBe(true)
    expect(calls[2].init.method).toBe('PUT')
    expect(calls[3].init.method).toBe('GET')
    expect(calls[3].url).toBe(tempUrl)
    expect(calls[4].init.method).toBe('DELETE')
    expect(calls[4].url).toBe(tempUrl)
    // 结果里不得出现密码
    expect(JSON.stringify(result)).not.toContain(PASSWORD)
  })

  it('成功链路不碰正式同步文件名', async () => {
    const { calls } = await runSuccess()
    for (const call of calls) {
      expect(call.url).not.toContain('blockhabit-data.json')
    }
  })

  it('连接阶段 401 仍说明服务器可达；认证阶段 401 → auth，后续 skipped', async () => {
    const { transport, calls } = makeTransport([response(401), response(401)])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })

    expect(result.ok).toBe(false)
    expect(result.stages.map((stage) => stage.stage)).toEqual([...STAGES])
    expect(result.stages[0]).toMatchObject({ stage: 'address', ok: true, code: 'ok' })
    expect(result.stages[1]).toMatchObject({
      stage: 'connection',
      ok: true,
      code: 'ok',
      status: 401
    })
    expect(result.stages[2]).toMatchObject({ stage: 'auth', ok: false, code: 'auth', status: 401 })
    expect(result.stages[3]).toMatchObject({ stage: 'readwrite', ok: true, code: 'skipped' })
    expect(result.stages[4]).toMatchObject({ stage: 'cleanup', ok: true, code: 'skipped' })
    expect(calls).toHaveLength(2) // 没有 PUT / DELETE
  })

  it('连接 401 + 认证 207 → 全部通过', async () => {
    const { transport } = makeTransport([
      response(401),
      response(207),
      response(201),
      response(200),
      response(204)
    ])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
    expect(result.ok).toBe(true)
  })

  it('认证 403 → forbidden', async () => {
    const { transport } = makeTransport([response(207), response(403)])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
    expect(result.stages[2]).toMatchObject({
      stage: 'auth',
      ok: false,
      code: 'forbidden',
      status: 403
    })
    expect(result.ok).toBe(false)
  })

  it('认证 404 → not-found（目录不存在）', async () => {
    const { transport } = makeTransport([response(404), response(404)])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
    expect(result.stages[2]).toMatchObject({
      stage: 'auth',
      ok: false,
      code: 'not-found',
      status: 404
    })
  })

  it('认证 405 → method（服务器不支持 PROPFIND）', async () => {
    const { transport } = makeTransport([response(405), response(405)])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
    expect(result.stages[2]).toMatchObject({
      stage: 'auth',
      ok: false,
      code: 'method',
      status: 405
    })
  })

  it('PUT 507 → quota，且不尝试清理（未创建文件）', async () => {
    const { transport, calls } = makeTransport([response(207), response(207), response(507)])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
    expect(result.stages[3]).toMatchObject({
      stage: 'readwrite',
      ok: false,
      code: 'quota',
      status: 507
    })
    expect(result.stages[4]).toMatchObject({ stage: 'cleanup', ok: true, code: 'skipped' })
    expect(calls).toHaveLength(3)
    expect(result.ok).toBe(false)
  })

  it('PUT 405 → method', async () => {
    const { transport } = makeTransport([response(207), response(207), response(405)])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
    expect(result.stages[3]).toMatchObject({
      stage: 'readwrite',
      ok: false,
      code: 'method',
      status: 405
    })
  })

  it('GET 读回 500：readwrite 失败但 cleanup 仍会 DELETE 临时文件', async () => {
    const { transport, calls } = makeTransport([
      response(207),
      response(207),
      response(201),
      response(500),
      response(204)
    ])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
    expect(result.stages[3]).toMatchObject({
      stage: 'readwrite',
      ok: false,
      code: 'http',
      status: 500
    })
    expect(result.stages[4]).toMatchObject({ stage: 'cleanup', ok: true, code: 'ok', status: 204 })
    expect(calls[4].init.method).toBe('DELETE')
    expect(result.ok).toBe(false)
  })

  it('读回内容与写入不一致 → readwrite http（readback mismatch），仍清理', async () => {
    const { transport, calls } = makeTransport([
      response(207),
      response(207),
      response(201),
      response(200, 'not-the-same-payload'),
      response(204)
    ])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
    expect(result.stages[3]).toMatchObject({
      stage: 'readwrite',
      ok: false,
      code: 'http',
      detail: 'readback mismatch'
    })
    expect(calls[4].init.method).toBe('DELETE')
    expect(result.ok).toBe(false)
  })

  it('清理 DELETE 405 → cleanup 失败并给出临时文件名，便于手动清理', async () => {
    const { transport, calls } = makeTransport([
      response(207),
      response(207),
      response(201),
      response(200),
      response(405)
    ])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
    expect(result.stages[4].ok).toBe(false)
    expect(result.stages[4].code).toBe('method')
    const tempName = calls[2].url.slice(calls[2].url.lastIndexOf('/') + 1)
    expect(tempName.endsWith(TEMP_FILE_SUFFIX)).toBe(true)
    expect(result.stages[4].detail).toBe(tempName)
    expect(result.ok).toBe(false)
  })

  it('清理 DELETE 404 视为已经删掉（幂等成功）', async () => {
    const { transport } = makeTransport([
      response(207),
      response(207),
      response(201),
      response(200),
      response(404)
    ])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
    expect(result.stages[4]).toMatchObject({ stage: 'cleanup', ok: true, code: 'ok', status: 404 })
    expect(result.ok).toBe(true)
  })

  it('连接阶段超时 → timeout，后续 skipped', async () => {
    const transport: DiagnoseTransport = () => new Promise<DiagnoseResponse>(() => {})
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport, timeoutMs: 20 })
    expect(result.stages[1]).toMatchObject({ stage: 'connection', ok: false, code: 'timeout' })
    expect(result.stages[2].code).toBe('skipped')
    expect(result.ok).toBe(false)
  })

  it('transport 抛 TimeoutError → timeout', async () => {
    const timeoutError = new Error('request timed out')
    timeoutError.name = 'TimeoutError'
    const { transport } = makeTransport([timeoutError])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
    expect(result.stages[1]).toMatchObject({ ok: false, code: 'timeout' })
  })

  it('TLS 证书错误文本 → tls', async () => {
    const { transport } = makeTransport([
      new Error('error trying to connect: invalid peer certificate: UnknownIssuer')
    ])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
    expect(result.stages[1]).toMatchObject({ ok: false, code: 'tls' })
  })

  it('DNS 解析失败 → unreachable，且 detail 保留脱敏原文', async () => {
    const { transport } = makeTransport([new Error('dns error: Name or service not known')])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
    expect(result.stages[1].ok).toBe(false)
    expect(result.stages[1].code).toBe('unreachable')
    expect(result.stages[1].detail).toContain('Name or service not known')
  })

  it('连接被拒绝 → unreachable', async () => {
    const { transport } = makeTransport([new Error('connect ECONNREFUSED 10.0.0.1:443')])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
    expect(result.stages[1].code).toBe('unreachable')
  })

  it('http:// 端点 → address insecure-http，且不发起任何请求', async () => {
    const { transport, calls } = makeTransport([response(207)])
    const result = await runWebDavDiagnosis({
      ...BASE_OPTIONS,
      endpoint: 'http://dav.example.com/dav/',
      transport
    })
    expect(result.stages[0]).toMatchObject({ stage: 'address', ok: false, code: 'insecure-http' })
    expect(result.stages.slice(1).every((stage) => stage.code === 'skipped')).toBe(true)
    expect(calls).toHaveLength(0)
    expect(result.ok).toBe(false)
  })

  it('空地址 / 非 http(s) 协议 → invalid-url，且不发起任何请求', async () => {
    for (const endpoint of ['', '   ', 'ftp://dav.example.com/dav/', 'not a url']) {
      const { transport, calls } = makeTransport([response(207)])
      const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, endpoint, transport })
      expect(result.stages[0]).toMatchObject({ stage: 'address', ok: false, code: 'invalid-url' })
      expect(calls).toHaveLength(0)
    }
  })

  it('地址规范化：无协议自动补 https、文件 URL 回退父目录、中文路径按段编码', async () => {
    const noScheme = await runSuccess({ endpoint: 'dav.example.com/dav' })
    expect(noScheme.calls[0].url).toBe('https://dav.example.com/dav/')

    const fileUrl = await runSuccess({
      endpoint: 'https://dav.example.com/dav/blockhabit-data.json'
    })
    expect(fileUrl.calls[0].url).toBe('https://dav.example.com/dav/')

    const chinese = await runSuccess({ endpoint: 'https://dav.example.com/备份/' })
    expect(chinese.calls[0].url).toContain('%E5%A4%87%E4%BB%BD/')
    expect(chinese.calls[0].url.endsWith('/')).toBe(true)
  })

  it('地址里的 userinfo 不会进入请求 URL 或结果', async () => {
    const { calls, result } = await runSuccess({
      endpoint: 'https://alice:secret-password@dav.example.com/dav/'
    })
    expect(calls[0].url).toBe('https://dav.example.com/dav/')
    expect(JSON.stringify(result)).not.toContain('secret-password')
  })

  it('临时文件名唯一（两次自检的 PUT URL 不同）', async () => {
    const first = await runSuccess()
    const second = await runSuccess()
    expect(first.calls[2].url).not.toBe(second.calls[2].url)
  })

  it('失败结果里不含密码：错误文本中的密码与 Basic 凭据都被脱敏', async () => {
    const authHeader = 'Basic ' + btoa('alice:' + PASSWORD)
    const { transport } = makeTransport([
      new Error(`connect failed for alice:${PASSWORD} header=${authHeader}`)
    ])
    const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain(PASSWORD)
    expect(serialized).not.toContain(authHeader.split(' ')[1])
    expect(result.stages[1].detail).toContain('***')
  })

  it('所有失败路径都产出完整五阶段（skipped 补齐）', async () => {
    const scripts: Step[][] = [
      [new Error('boom')],
      [response(401), response(401)],
      [response(207), response(403)],
      [response(207), response(207), response(507)],
      [response(207), response(207), response(201), response(500), response(204)]
    ]
    for (const script of scripts) {
      const { transport } = makeTransport(script)
      const result = await runWebDavDiagnosis({ ...BASE_OPTIONS, transport })
      expect(result.stages.map((stage) => stage.stage)).toEqual([...STAGES])
    }
  })
})

describe('diagnose：用户取消（B1）', () => {
  it('已预置取消：cancelled=true、五阶段补齐、不发起任何请求', async () => {
    const { transport, calls } = makeTransport([response(207)])
    const controller = new AbortController()
    controller.abort()
    const result = await runWebDavDiagnosis({
      ...BASE_OPTIONS,
      transport,
      signal: controller.signal
    })
    expect(result.cancelled).toBe(true)
    expect(result.ok).toBe(false)
    expect(result.stages.map((stage) => stage.stage)).toEqual([...STAGES])
    expect(result.stages[0]).toMatchObject({ stage: 'address', ok: false, code: 'cancelled' })
    expect(result.stages.slice(1).every((stage) => stage.code === 'skipped')).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('连接阶段取消：标记 cancelled，后续阶段 skipped，不误报超时', async () => {
    const calls: RecordedCall[] = []
    const transport: DiagnoseTransport = (url, init) => {
      calls.push({ url, init })
      return new Promise<DiagnoseResponse>((_resolve, reject) => {
        const abort = () => reject(new DOMException('Aborted', 'AbortError'))
        if (init.signal?.aborted) return abort()
        init.signal?.addEventListener('abort', abort, { once: true })
      })
    }
    const controller = new AbortController()
    const pending = runWebDavDiagnosis({
      ...BASE_OPTIONS,
      transport,
      signal: controller.signal,
      timeoutMs: 5000
    })
    const deadline = Date.now() + 1000
    while (calls.length === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 1))
    controller.abort()
    const result = await pending
    expect(result.cancelled).toBe(true)
    expect(result.stages[1]).toMatchObject({ stage: 'connection', ok: false, code: 'cancelled' })
    expect(result.stages[2].code).toBe('skipped')
    expect(result.stages[3].code).toBe('skipped')
    expect(result.stages[4].code).toBe('skipped')
    expect(result.ok).toBe(false)
  })

  it('读写阶段取消（GET 挂起）：仍尽力 DELETE 清理临时文件', async () => {
    const calls: RecordedCall[] = []
    const transport: DiagnoseTransport = (url, init) => {
      calls.push({ url, init })
      if (init.method === 'PROPFIND') return Promise.resolve(response(207))
      if (init.method === 'PUT') return Promise.resolve(response(201))
      if (init.method === 'GET') {
        return new Promise<DiagnoseResponse>((_resolve, reject) => {
          const abort = () => reject(new DOMException('Aborted', 'AbortError'))
          if (init.signal?.aborted) return abort()
          init.signal?.addEventListener('abort', abort, { once: true })
        })
      }
      return Promise.resolve(response(204))
    }
    const controller = new AbortController()
    const pending = runWebDavDiagnosis({
      ...BASE_OPTIONS,
      transport,
      signal: controller.signal,
      timeoutMs: 5000
    })
    const deadline = Date.now() + 1000
    while (!calls.some((call) => call.init.method === 'GET') && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1))
    }
    controller.abort()
    const result = await pending
    expect(result.cancelled).toBe(true)
    expect(result.stages[3]).toMatchObject({ stage: 'readwrite', ok: false, code: 'cancelled' })
    expect(result.stages[4]).toMatchObject({ stage: 'cleanup', ok: true, code: 'ok', status: 204 })
    const putCall = calls.find((call) => call.init.method === 'PUT')
    const deleteCall = calls.find((call) => call.init.method === 'DELETE')
    expect(putCall).toBeDefined()
    expect(deleteCall).toBeDefined()
    expect(deleteCall?.url).toBe(putCall?.url)
  })

  it('取消时清理失败不掩盖 cancelled，但 cleanup 如实失败', async () => {
    const calls: RecordedCall[] = []
    const transport: DiagnoseTransport = (url, init) => {
      calls.push({ url, init })
      if (init.method === 'PROPFIND') return Promise.resolve(response(207))
      if (init.method === 'PUT') return Promise.resolve(response(201))
      if (init.method === 'GET') {
        return new Promise<DiagnoseResponse>((_resolve, reject) => {
          const abort = () => reject(new DOMException('Aborted', 'AbortError'))
          if (init.signal?.aborted) return abort()
          init.signal?.addEventListener('abort', abort, { once: true })
        })
      }
      return Promise.resolve(response(405))
    }
    const controller = new AbortController()
    const pending = runWebDavDiagnosis({
      ...BASE_OPTIONS,
      transport,
      signal: controller.signal,
      timeoutMs: 5000
    })
    const deadline = Date.now() + 1000
    while (!calls.some((call) => call.init.method === 'GET') && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1))
    }
    controller.abort()
    const result = await pending
    expect(result.cancelled).toBe(true)
    expect(result.stages[4]).toMatchObject({ stage: 'cleanup', ok: false, code: 'method' })
  })
})

describe('diagnose：工具函数', () => {
  it('DIAGNOSE_TIMEOUT_MS 默认为 10s；makeTempFileName 带固定后缀且默认唯一', () => {
    expect(DIAGNOSE_TIMEOUT_MS).toBe(10000)
    const a = makeTempFileName()
    const b = makeTempFileName()
    expect(a.endsWith(TEMP_FILE_SUFFIX)).toBe(true)
    expect(b.endsWith(TEMP_FILE_SUFFIX)).toBe(true)
    expect(a).not.toBe(b)
    expect(makeTempFileName('seeded')).toBe('seeded.blockhabit-test.json')
  })

  it('normalizeCollectionUrl：补协议、补尾斜杠、去 query/userinfo、拒绝非 http(s)', () => {
    expect(normalizeCollectionUrl('dav.example.com/dav')).toBe('https://dav.example.com/dav/')
    expect(normalizeCollectionUrl('https://dav.example.com/dav?token=x#h')).toBe(
      'https://dav.example.com/dav/'
    )
    expect(normalizeCollectionUrl('https://u:p@dav.example.com/dav/')).toBe(
      'https://dav.example.com/dav/'
    )
    expect(normalizeCollectionUrl('https://dav.example.com/file.json')).toBe(
      'https://dav.example.com/'
    )
    expect(normalizeCollectionUrl('ftp://dav.example.com/')).toBeNull()
    expect(normalizeCollectionUrl('')).toBeNull()
  })

  it('sanitizeDiagnosticDetail：抹密码 / Basic / userinfo，折叠空白并截断', () => {
    expect(sanitizeDiagnosticDetail('bad secret-password here', ['secret-password'])).toBe(
      'bad *** here'
    )
    expect(sanitizeDiagnosticDetail('Authorization: Basic dXNlcjpwYXNz')).toBe(
      'Authorization: Basic ***'
    )
    expect(sanitizeDiagnosticDetail('fetch https://alice:pw@host/dav failed')).toBe(
      'fetch https://***@host/dav failed'
    )
    expect(sanitizeDiagnosticDetail('a\n\n  b\tc')).toBe('a b c')
    const long = sanitizeDiagnosticDetail('x'.repeat(500))
    expect(long.length).toBe(300)
    expect(long.endsWith('…')).toBe(true)
    expect(sanitizeDiagnosticDetail('')).toBe('')
  })

  it('classifyTransportError：timeout / tls / unreachable / unknown', () => {
    const timeout = new Error('done')
    timeout.name = 'TimeoutError'
    expect(classifyTransportError(timeout).code).toBe('timeout')
    expect(classifyTransportError(new Error('request timed out')).code).toBe('timeout')
    expect(classifyTransportError(new Error('invalid peer certificate: UnknownIssuer')).code).toBe(
      'tls'
    )
    expect(classifyTransportError(new Error('getaddrinfo ENOTFOUND dav.example.com')).code).toBe(
      'unreachable'
    )
    expect(classifyTransportError(new Error('connect ECONNREFUSED')).code).toBe('unreachable')
    expect(classifyTransportError(new Error('weird internal thing')).code).toBe('unknown')
    expect(classifyTransportError(new Error('weird internal thing')).detail).toContain(
      'weird internal thing'
    )
  })

  it('createFetchTransport：把 fetch 形状适配成 transport，并透传 method/headers/body', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = []
    const fakeFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      seen.push({ url, init })
      return {
        status: 207,
        ok: true,
        text: async () => 'multi-status',
        headers: {
          forEach: (callback: (value: string, key: string) => void) => {
            callback('application/xml', 'Content-Type')
          }
        }
      } as unknown as Response
    }
    const transport = createFetchTransport(fakeFetch)
    const result = await transport('https://dav.example.com/dav/', {
      method: 'PROPFIND',
      headers: { Depth: '0' }
    })
    expect(result).toEqual({
      status: 207,
      ok: true,
      text: 'multi-status',
      headers: { 'content-type': 'application/xml' }
    })
    expect(seen[0].url).toBe('https://dav.example.com/dav/')
    expect(seen[0].init?.method).toBe('PROPFIND')
    expect(seen[0].init?.headers).toEqual({ Depth: '0' })
  })

  it('createFetchTransport：fetch 抛错时原样抛给上层归类', async () => {
    const transport = createFetchTransport(async () => {
      throw new Error('dns error: Name or service not known')
    })
    await expect(transport('https://dav.example.com/', { method: 'PROPFIND' })).rejects.toThrow(
      'dns error'
    )
  })
})
