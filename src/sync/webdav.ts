import type { WebDavConfig } from './types'

export function getSyncUrl(endpoint: string): string {
  const trimmed = endpoint.trim()
  if (!trimmed) return ''
  if (trimmed.endsWith('.json')) {
    return trimmed
  }
  return trimmed.endsWith('/') ? `${trimmed}blockhabit-data.json` : `${trimmed}/blockhabit-data.json`
}

export function getAuthHeaders(config: WebDavConfig): Record<string, string> {
  if (!config.username && !config.password) {
    return {}
  }
  const credentials = `${config.username}:${config.password}`
  let encoded: string
  try {
    encoded = btoa(unescape(encodeURIComponent(credentials)))
  } catch {
    encoded = btoa(credentials)
  }
  return {
    Authorization: `Basic ${encoded}`,
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
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error(`WebDAV authentication failed (${response.status})`)
  }

  if (!response.ok && response.status !== 201 && response.status !== 204) {
    throw new Error(`WebDAV push failed: ${response.status} ${response.statusText}`)
  }
}
