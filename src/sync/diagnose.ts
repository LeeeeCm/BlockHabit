/**
 * A3 / D-20261110-061：WebDAV 分步连接自检（纯逻辑，transport 注入）。
 *
 * 五个阶段：address（规范化/协议）→ connection（可达性 + TLS）→ auth（401/403/404/405）
 * → readwrite（PUT 临时文件 → GET 读回；507/405）→ cleanup（DELETE 临时文件）。
 *
 * 设计约束：
 * - 模块本身不依赖 Tauri / fetch / React：所有网络调用经 DiagnoseTransport 注入，
 *   便于单测，也让 Lead 用 httpFetch（桌面原生 HTTP，绕 CORS）包装即可；
 * - 单阶段超时默认 10s：AbortSignal 取消真实请求 + Promise.race 兜住不响应信号的实现；
 * - 结果 detail 一律脱敏（密码、Basic 凭据、URL userinfo 不进结果）；
 * - 不写正式同步文件：临时文件名带时间戳 + 随机串，PUT 成功后无论 GET 成败都会尝试 DELETE。
 */
import { encodeUrlPath, getAuthHeaders } from './webdav'

/** 单阶段默认超时（ms） */
export const DIAGNOSE_TIMEOUT_MS = 10000

/** 临时文件后缀（前缀是时间戳 + 随机串） */
export const TEMP_FILE_SUFFIX = '.blockhabit-test.json'

export type DiagnoseStage = 'address' | 'connection' | 'auth' | 'readwrite' | 'cleanup'

export type DiagnoseCode =
  | 'ok'
  | 'invalid-url'
  | 'insecure-http'
  | 'unreachable'
  | 'tls'
  | 'auth'
  | 'forbidden'
  | 'not-found'
  | 'quota'
  | 'method'
  | 'timeout'
  | 'http'
  | 'unknown'
  | 'skipped'

export interface DiagnoseStageResult {
  stage: DiagnoseStage
  ok: boolean
  code: DiagnoseCode
  /** HTTP 状态码（拿到响应时才有） */
  status?: number
  /** 脱敏后的可复制诊断信息（不含密码/凭据/userinfo） */
  detail?: string
}

export interface DiagnoseResult {
  /** 只有五个阶段全部通过才为 true；skipped 不算失败 */
  ok: boolean
  stages: DiagnoseStageResult[]
  elapsedMs: number
}

export interface DiagnoseRequestInit {
  method: string
  headers?: Record<string, string>
  body?: string
  signal?: AbortSignal
}

export interface DiagnoseResponse {
  status: number
  ok: boolean
  text?: string
  headers?: Record<string, string>
}

export type DiagnoseTransport = (url: string, init: DiagnoseRequestInit) => Promise<DiagnoseResponse>

export interface DiagnoseOptions {
  /** 集合 URL（可带 .json 文件 URL，自检会回退到其父目录） */
  endpoint: string
  username: string
  password: string
  transport: DiagnoseTransport
  /** 单阶段超时，默认 DIAGNOSE_TIMEOUT_MS */
  timeoutMs?: number
}

/** 供 Lead 把 platform/http 的 httpFetch 直接包成 DiagnoseTransport */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

class DiagnoseTimeoutError extends Error {
  constructor() {
    super('WebDAV diagnose request timed out')
    this.name = 'TimeoutError'
  }
}

interface StageOutcome {
  ok: boolean
  code: DiagnoseCode
  status?: number
  detail?: string
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

/**
 * 生成唯一临时文件名：<时间戳 base36>-<随机串>.blockhabit-test.json。
 * 用注入 seed 便于测试；默认 seed 在真实环境里足够唯一（同一进程内不会碰撞）。
 */
export function makeTempFileName(seed?: string): string {
  const unique =
    seed ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${unique}${TEMP_FILE_SUFFIX}`
}

/**
 * 规范化集合 URL（地址阶段）：
 * - 无协议 / 协议相对 → 补 https://；
 * - 只接受 http/https 且必须有主机；
 * - 去掉 query / hash / userinfo（避免凭据进入结果与日志）；
 * - 以 / 结尾；若用户贴的是同步文件 URL（带扩展名）则回退到父目录。
 * 无法规范化时返回 null。
 */
export function normalizeCollectionUrl(input: string): string | null {
  let value = String(input ?? '').trim()
  if (!value) return null
  if (value.startsWith('//')) value = `https:${value}`
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname) return null

  url.search = ''
  url.hash = ''
  url.username = ''
  url.password = ''

  if (!url.pathname.endsWith('/')) {
    const lastSegment = url.pathname.slice(url.pathname.lastIndexOf('/') + 1)
    // 看起来像文件（如 blockhabit-data.json）→ 取父目录；否则当目录补斜杠
    if (/\.[a-z0-9]{1,8}$/i.test(lastSegment)) {
      url.pathname = url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1)
    } else {
      url.pathname = `${url.pathname}/`
    }
  }
  if (!url.pathname) url.pathname = '/'
  // encodeUrlPath 会丢掉尾部空段，这里补回集合 URL 必需的尾斜杠
  const encoded = encodeUrlPath(url.toString())
  return encoded.endsWith('/') ? encoded : `${encoded}/`
}

/**
 * 详情脱敏：
 * - 抹掉调用方提供的 secret（密码）；
 * - 抹掉 Basic 凭据与 URL userinfo；
 * - 折叠空白并截断（默认 300 字符）。
 */
export function sanitizeDiagnosticDetail(
  input: string,
  secrets: Array<string | undefined> = [],
  maxLength = 300,
): string {
  let text = String(input ?? '')
  if (!text) return ''
  for (const secret of secrets) {
    if (!secret) continue
    text = text.split(secret).join('***')
  }
  text = text.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic ***')
  text = text.replace(/\/\/[^/@\s]+@/g, '//***@')
  text = text.replace(/\s+/g, ' ').trim()
  if (text.length > maxLength) {
    text = `${text.slice(0, Math.max(0, maxLength - 1))}…`
  }
  return text
}

/**
 * 网络/传输错误归类（启发式）：
 * JS 侧拿不到结构化的 TLS/DNS 错误，只能按名称与错误文本归类；
 * 归类不出来时返回 unknown 并保留脱敏原文（不假装比实际更精确）。
 */
export function classifyTransportError(err: unknown): { code: DiagnoseCode; detail: string } {
  const name = err instanceof Error ? err.name : ''
  const message = err instanceof Error ? err.message : String(err ?? '')
  const probe = `${name} ${message}`.toLowerCase()

  if (name === 'TimeoutError' || name === 'AbortError' || /timeout|timed out|超时|aborted|abort/.test(probe)) {
    return { code: 'timeout', detail: message }
  }
  if (/certificate|tls|ssl|handshake|self.?signed|issuer|x509|peer failed/.test(probe)) {
    return { code: 'tls', detail: message }
  }
  if (/dns|lookup|getaddrinfo|enotfound|nodename nor servname/.test(probe)) {
    return { code: 'unreachable', detail: message }
  }
  if (/econnrefused|econnreset|ehostunreach|enetunreach|unreachable|network ?error|network request failed|failed to fetch|load failed|socket/.test(probe)) {
    return { code: 'unreachable', detail: message }
  }
  return { code: 'unknown', detail: message }
}

/**
 * 把「fetch 形状」的函数（platform/http 的 httpFetch、或测试用的假 fetch）
 * 适配成 DiagnoseTransport。httpFetch 的签名与此处 FetchLike 完全一致：
 *   createFetchTransport(httpFetch)
 */
export function createFetchTransport(fetchImpl: FetchLike): DiagnoseTransport {
  return async (url, init) => {
    const response = await fetchImpl(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      signal: init.signal,
    })
    let text: string | undefined
    try {
      text = await response.text()
    } catch {
      text = undefined
    }
    const headers: Record<string, string> = {}
    const source = response.headers
    if (source && typeof source.forEach === 'function') {
      source.forEach((value: string, key: string) => {
        headers[String(key).toLowerCase()] = String(value)
      })
    }
    return { status: response.status, ok: response.ok, text, headers }
  }
}

async function requestWithTimeout(
  transport: DiagnoseTransport,
  url: string,
  init: DiagnoseRequestInit,
  timeoutMs: number,
): Promise<DiagnoseResponse> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller?.abort()
      reject(new DiagnoseTimeoutError())
    }, timeoutMs)
  })
  try {
    return await Promise.race([
      transport(url, { ...init, signal: controller?.signal }),
      timeout,
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** 通用状态码归类（PROPFIND / PUT / GET 共用） */
function classifyHttpStatus(status: number): StageOutcome {
  if (status >= 200 && status < 300) return { ok: true, code: 'ok', status }
  if (status === 401) return { ok: false, code: 'auth', status }
  if (status === 403) return { ok: false, code: 'forbidden', status }
  if (status === 404) return { ok: false, code: 'not-found', status }
  if (status === 405) return { ok: false, code: 'method', status }
  if (status === 507) return { ok: false, code: 'quota', status }
  return { ok: false, code: 'http', status }
}

/** DELETE 的 404 视为「已经删掉了」，属于清理成功 */
function classifyDeleteStatus(status: number): StageOutcome {
  if (status === 404) return { ok: true, code: 'ok', status }
  return classifyHttpStatus(status)
}

function protocolOf(url: string): string {
  try {
    return new URL(url).protocol
  } catch {
    return ''
  }
}

function authHeadersFor(username: string, password: string): Record<string, string> {
  return getAuthHeaders({ endpoint: '', username: String(username ?? ''), password: String(password ?? ''), enabled: true })
}

/**
 * 执行一次完整自检。任何阶段失败后，后续阶段标记 skipped（ok=true, code='skipped'）；
 * 唯一例外是 cleanup：只要临时文件可能已创建（PUT 成功），无论 GET 成败都会尝试 DELETE。
 * 本函数不抛异常（错误都收敛进 stages）。
 */
export async function runWebDavDiagnosis(options: DiagnoseOptions): Promise<DiagnoseResult> {
  const startedAt = nowMs()
  const timeoutMs =
    typeof options.timeoutMs === 'number' && options.timeoutMs > 0 ? options.timeoutMs : DIAGNOSE_TIMEOUT_MS
  const secrets: Array<string | undefined> = [options.password]
  const stages: DiagnoseStageResult[] = []

  const push = (stage: DiagnoseStage, outcome: StageOutcome): void => {
    const result: DiagnoseStageResult = { stage, ok: outcome.ok, code: outcome.code }
    if (outcome.status !== undefined) result.status = outcome.status
    if (outcome.detail) result.detail = outcome.detail
    stages.push(result)
  }
  const skip = (stage: DiagnoseStage): void => push(stage, { ok: true, code: 'skipped' })
  const finish = (): DiagnoseResult => ({
    ok: stages.length === 5 && stages.every((stage) => stage.ok),
    stages,
    elapsedMs: Math.max(0, Math.round(nowMs() - startedAt)),
  })

  // 1) 地址：规范化 + 协议检查（http 会被 Tauri CSP 拦掉，提前给出明确结论）
  const collectionUrl = normalizeCollectionUrl(options.endpoint)
  if (!collectionUrl) {
    push('address', {
      ok: false,
      code: 'invalid-url',
      detail: sanitizeDiagnosticDetail(options.endpoint, secrets),
    })
    skip('connection')
    skip('auth')
    skip('readwrite')
    skip('cleanup')
    return finish()
  }
  if (protocolOf(collectionUrl) === 'http:') {
    push('address', {
      ok: false,
      code: 'insecure-http',
      detail: sanitizeDiagnosticDetail(collectionUrl, secrets),
    })
    skip('connection')
    skip('auth')
    skip('readwrite')
    skip('cleanup')
    return finish()
  }
  push('address', { ok: true, code: 'ok', detail: sanitizeDiagnosticDetail(collectionUrl, secrets) })

  const transport = options.transport
  const authHeaders = authHeadersFor(options.username, options.password)

  // 2) 连接：不带凭据的 PROPFIND，只验证 TLS/可达；401/403/404 都说明服务器活着
  try {
    const response = await requestWithTimeout(
      transport,
      collectionUrl,
      { method: 'PROPFIND', headers: { Depth: '0' } },
      timeoutMs,
    )
    push('connection', { ok: true, code: 'ok', status: response.status })
  } catch (err) {
    const classified = classifyTransportError(err)
    push('connection', {
      ok: false,
      code: classified.code,
      detail: sanitizeDiagnosticDetail(classified.detail, secrets),
    })
    skip('auth')
    skip('readwrite')
    skip('cleanup')
    return finish()
  }

  // 3) 认证：带 Basic Auth 的 PROPFIND
  try {
    const response = await requestWithTimeout(
      transport,
      collectionUrl,
      { method: 'PROPFIND', headers: { ...authHeaders, Depth: '0' } },
      timeoutMs,
    )
    const outcome = classifyHttpStatus(response.status)
    push('auth', outcome)
    if (!outcome.ok) {
      skip('readwrite')
      skip('cleanup')
      return finish()
    }
  } catch (err) {
    const classified = classifyTransportError(err)
    push('auth', {
      ok: false,
      code: classified.code,
      detail: sanitizeDiagnosticDetail(classified.detail, secrets),
    })
    skip('readwrite')
    skip('cleanup')
    return finish()
  }

  // 4) 读写：PUT 临时文件 → GET 读回（不碰正式同步文件）
  const tempName = makeTempFileName()
  const tempUrl = encodeUrlPath(`${collectionUrl}${tempName}`)
  const payload = JSON.stringify({ blockhabit: 'diagnose', at: new Date().toISOString() })
  let tempCreated = false
  try {
    const putResponse = await requestWithTimeout(
      transport,
      tempUrl,
      {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        body: payload,
      },
      timeoutMs,
    )
    const putOutcome = classifyHttpStatus(putResponse.status)
    if (!putOutcome.ok) {
      push('readwrite', putOutcome)
      skip('cleanup') // PUT 失败视为未创建文件，避免把「PUT 405」放大成「清理也失败」
      return finish()
    }
    tempCreated = true

    const getResponse = await requestWithTimeout(
      transport,
      tempUrl,
      { method: 'GET', headers: authHeaders },
      timeoutMs,
    )
    const getOutcome = classifyHttpStatus(getResponse.status)
    if (!getOutcome.ok) {
      push('readwrite', getOutcome)
    } else if (typeof getResponse.text === 'string' && getResponse.text !== payload) {
      push('readwrite', { ok: false, code: 'http', detail: 'readback mismatch' })
    } else {
      push('readwrite', { ok: true, code: 'ok', status: getResponse.status })
    }
  } catch (err) {
    const classified = classifyTransportError(err)
    push('readwrite', {
      ok: false,
      code: classified.code,
      detail: sanitizeDiagnosticDetail(classified.detail, secrets),
    })
  }

  // 5) 清理：确保临时文件不留在用户服务器上（PUT 成功后必定尝试）
  if (!tempCreated) {
    skip('cleanup')
    return finish()
  }
  try {
    const deleteResponse = await requestWithTimeout(
      transport,
      tempUrl,
      { method: 'DELETE', headers: authHeaders },
      timeoutMs,
    )
    const outcome = classifyDeleteStatus(deleteResponse.status)
    if (outcome.ok) {
      push('cleanup', outcome)
    } else {
      push('cleanup', { ...outcome, detail: tempName })
    }
  } catch (err) {
    const classified = classifyTransportError(err)
    push('cleanup', {
      ok: false,
      code: classified.code,
      detail: sanitizeDiagnosticDetail(`${classified.detail} ${tempName}`, secrets),
    })
  }

  return finish()
}
