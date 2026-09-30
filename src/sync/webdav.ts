import type { WebDavConfig } from './types'

export const GET_TIMEOUT_MS = 15000
export const PUT_TIMEOUT_MS = 30000
export const SYNC_FILE_NAME = 'blockhabit-data.json'

/** 同步层错误码：UI 侧按 code 映射 i18n 文案 */
export type WebDavErrorCode = 'auth' | 'network' | 'conflict' | 'no-collection' | 'http'

export class WebDavError extends Error {
  code: WebDavErrorCode
  status?: number
  constructor(code: WebDavErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'WebDavError'
    this.code = code
    this.status = status
  }
}

export function getSyncUrl(endpoint: string): string {
  let trimmed = endpoint.trim()
  if (!trimmed) return ''
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`
  }
  if (trimmed.endsWith('.json')) {
    return encodeUrlPath(trimmed)
  }
  const file = trimmed.endsWith('/') ? `${trimmed}${SYNC_FILE_NAME}` : `${trimmed}/${SYNC_FILE_NAME}`
  return encodeUrlPath(file)
}

/** 对路径段做编码；已编码过的段保持原样（避免双重编码） */
function encodeUrlPath(url: string): string {
  const schemeEnd = url.indexOf('://') + 3
  const pathStart = url.indexOf('/', schemeEnd)
  if (pathStart < 0) return url
  const base = url.slice(0, pathStart)
  const path = url.slice(pathStart + 1)
  const encoded = path
    .split('/')
    .filter((seg) => seg.length > 0)
    .map((seg) => {
      try {
        if (seg !== decodeURIComponent(seg)) return seg
      } catch {
        // 含非法 % 序列：按未编码处理
      }
      return encodeURIComponent(seg)
    })
    .join('/')
  return `${base}/${encoded}`
}

function utf8ToBase64(str: string): string {
  if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(str)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i])
    }
    return btoa(bin)
  }
  // 极老环境兜底（TextEncoder 缺失时按 UTF-8 语义近似处理）
  return btoa(unescape(encodeURIComponent(str)))
}

export function getAuthHeaders(config: WebDavConfig): Record<string, string> {
  if (!config.username && !config.password) {
    return {}
  }
  const credentials = `${config.username}:${config.password}`
  return {
    Authorization: `Basic ${utf8ToBase64(credentials)}`,
  }
}

export interface RemoteFetchResult {
  json: string | null
  /** 服务器返回的 ETag（条件写用；服务器不支持时为 null） */
  etag: string | null
}

/**
 * Fetches remote AppState JSON from WebDAV server.
 * - 200 → { json, etag }
 * - 404 → 用 PROPFIND 二次确认路径可达且文件确实不存在，返回 { json: null }；
 *   PROPFIND 也 404 说明集合（目录）不存在，抛 no-collection，避免把本地档推到错误路径。
 */
export async function fetchRemoteState(config: WebDavConfig): Promise<RemoteFetchResult> {
  const url = getSyncUrl(config.endpoint)
  if (!url) {
    throw new WebDavError('network', 'WebDAV endpoint not configured')
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        ...getAuthHeaders(config),
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(GET_TIMEOUT_MS),
    })
  } catch (err) {
    if (err instanceof WebDavError) throw err
    throw new WebDavError('network', `WebDAV request failed: ${String(err)}`)
  }

  if (response.status === 404) {
    return await confirmCollectionEmpty(config, url)
  }
  if (response.status === 401 || response.status === 403) {
    throw new WebDavError('auth', `WebDAV authentication failed (${response.status})`, response.status)
  }
  if (!response.ok) {
    throw new WebDavError('http', `WebDAV request failed: ${response.status} ${response.statusText}`, response.status)
  }

  return { json: await response.text(), etag: response.headers.get('etag') ?? response.headers.get('ETag') }
}

/** 404 后的二次确认：PROPFIND（Depth: 0）207/200 = 目录存在、文件确实不存在 */
async function confirmCollectionEmpty(config: WebDavConfig, fileUrl: string): Promise<RemoteFetchResult> {
  const dirUrl = fileUrl.slice(0, fileUrl.lastIndexOf('/') + 1)
  let propfind: Response
  try {
    propfind = await fetch(dirUrl, {
      method: 'PROPFIND',
      headers: {
        ...getAuthHeaders(config),
        Depth: '0',
      },
      signal: AbortSignal.timeout(GET_TIMEOUT_MS),
    })
  } catch (err) {
    throw new WebDavError('network', `WebDAV request failed: ${String(err)}`)
  }
  if (propfind.status === 404) {
    throw new WebDavError('no-collection', `WebDAV collection does not exist: ${dirUrl}`, 404)
  }
  if (propfind.status === 401 || propfind.status === 403) {
    throw new WebDavError('auth', `WebDAV authentication failed (${propfind.status})`, propfind.status)
  }
  if (!propfind.ok && propfind.status !== 207) {
    throw new WebDavError('http', `WebDAV PROPFIND failed: ${propfind.status}`, propfind.status)
  }
  return { json: null, etag: null }
}

function parentCollectionUrl(fileUrl: string): string {
  return fileUrl.slice(0, fileUrl.lastIndexOf('/') + 1)
}

/**
 * Pushes merged AppState JSON to WebDAV server via HTTP PUT.
 * - 携带 If-Match（服务器支持 ETag 时）做条件写，防止双设备 lost update；
 * - 412 → conflict（调用方重拉重并）；409 → 父目录缺失，先 MKCOL 再重试一次。
 */
export async function pushRemoteState(config: WebDavConfig, json: string, etag?: string | null): Promise<void> {
  const url = getSyncUrl(config.endpoint)
  if (!url) {
    throw new WebDavError('network', 'WebDAV endpoint not configured')
  }

  const headers: Record<string, string> = {
    ...getAuthHeaders(config),
    'Content-Type': 'application/json; charset=utf-8',
  }
  if (etag) {
    headers['If-Match'] = etag
  }

  const doPut = async (extraHeaders: Record<string, string>): Promise<Response> => {
    try {
      return await fetch(url, {
        method: 'PUT',
        headers: { ...headers, ...extraHeaders },
        body: json,
        signal: AbortSignal.timeout(PUT_TIMEOUT_MS),
      })
    } catch (err) {
      throw new WebDavError('network', `WebDAV request failed: ${String(err)}`)
    }
  }

  let response = await doPut({})
  if (response.status === 409) {
    // 父集合缺失：创建目录后重试一次
    let mkcolOk = false
    try {
      const mkcol = await fetch(parentCollectionUrl(url), {
        method: 'MKCOL',
        headers: getAuthHeaders(config),
        signal: AbortSignal.timeout(GET_TIMEOUT_MS),
      })
      mkcolOk = mkcol.ok || mkcol.status === 201
    } catch (err) {
      throw new WebDavError('network', `WebDAV MKCOL failed: ${String(err)}`)
    }
    if (mkcolOk) {
      response = await doPut({})
    }
  }

  if (response.status === 401 || response.status === 403) {
    throw new WebDavError('auth', `WebDAV authentication failed (${response.status})`, response.status)
  }
  if (response.status === 412) {
    throw new WebDavError('conflict', 'WebDAV precondition failed (remote updated concurrently)', 412)
  }
  if (!response.ok && response.status !== 201 && response.status !== 204) {
    throw new WebDavError('http', `WebDAV push failed: ${response.status} ${response.statusText}`, response.status)
  }
}
