import type { WebDavConfig } from './types'

export const DEFAULT_WEBDAV_TIMEOUT_MS = 15000

export function getSyncUrl(endpoint: string): string {
  let trimmed = endpoint.trim()
  if (!trimmed) return ''
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`
  }
  if (trimmed.endsWith('.json')) {
    return trimmed
  }
  return trimmed.endsWith('/') ? `${trimmed}blockhabit-data.json` : `${trimmed}/blockhabit-data.json`
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
  return btoa(encodeURIComponent(str))
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

/**
 * Fetches remote AppState JSON from WebDAV server.
 * Returns null if remote file does not exist (404), enabling clean initial sync.
 */
export async function fetchRemoteState(config: WebDavConfig): Promise<string | null> {
  const url = getSyncUrl(config.endpoint)
  if (!url) {
    throw new Error('WebDAV endpoint not configured')
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(config),
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(DEFAULT_WEBDAV_TIMEOUT_MS),
  })

  if (response.status === 404) {
    return null
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(`WebDAV authentication failed (${response.status})`)
  }

  if (!response.ok) {
    throw new Error(`WebDAV request failed: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

/**
 * Pushes merged AppState JSON to WebDAV server via HTTP PUT.
 */
export async function pushRemoteState(config: WebDavConfig, json: string): Promise<void> {
  const url = getSyncUrl(config.endpoint)
  if (!url) {
    throw new Error('WebDAV endpoint not configured')
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(config),
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: json,
    signal: AbortSignal.timeout(DEFAULT_WEBDAV_TIMEOUT_MS),
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error(`WebDAV authentication failed (${response.status})`)
  }

  if (!response.ok && response.status !== 201 && response.status !== 204) {
    throw new Error(`WebDAV push failed: ${response.status} ${response.statusText}`)
  }
}
