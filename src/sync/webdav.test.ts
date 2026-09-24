import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchRemoteState, pushRemoteState, getSyncUrl, getAuthHeaders } from './webdav'
import type { WebDavConfig } from './types'

describe('WebDAV client', () => {
  const mockConfig: WebDavConfig = {
    endpoint: 'https://dav.example.com/sync/',
    username: 'user',
    password: 'secret-password',
    enabled: true,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes endpoint url correctly', () => {
    expect(getSyncUrl('https://dav.example.com/dav/')).toBe('https://dav.example.com/dav/blockhabit-data.json')
    expect(getSyncUrl('https://dav.example.com/dav')).toBe('https://dav.example.com/dav/blockhabit-data.json')
    expect(getSyncUrl('https://dav.example.com/my-custom-backup.json')).toBe('https://dav.example.com/my-custom-backup.json')
    expect(getSyncUrl('')).toBe('')
  })

  it('generates Basic Auth header with base64 encoding', () => {
    const headers = getAuthHeaders(mockConfig)
    expect(headers.Authorization).toBe(`Basic ${btoa('user:secret-password')}`)
  })

  it('fetchRemoteState returns json text on 200 OK', () => {
    const mockJson = JSON.stringify({ schemaVersion: 1, habits: [] })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(mockJson, { status: 200, statusText: 'OK' }),
    )

    return fetchRemoteState(mockConfig).then((result) => {
      expect(result).toBe(mockJson)
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://dav.example.com/sync/blockhabit-data.json',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        }),
      )
    })
  })

  it('fetchRemoteState handles 404 cleanly by returning null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 404, statusText: 'Not Found' }),
    )

    const result = await fetchRemoteState(mockConfig)
    expect(result).toBeNull()
  })

  it('fetchRemoteState throws on 401 Unauthorized', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 401, statusText: 'Unauthorized' }),
    )

    await expect(fetchRemoteState(mockConfig)).rejects.toThrow('WebDAV authentication failed (401)')
  })

  it('pushRemoteState sends PUT request with payload', async () => {
    const mockJson = JSON.stringify({ schemaVersion: 1, habits: [] })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 204, statusText: 'No Content' }),
    )

    await pushRemoteState(mockConfig, mockJson)
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://dav.example.com/sync/blockhabit-data.json',
      expect.objectContaining({
        method: 'PUT',
        body: mockJson,
      }),
    )
  })

  it('pushRemoteState throws on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 500, statusText: 'Internal Server Error' }),
    )

    await expect(pushRemoteState(mockConfig, '{}')).rejects.toThrow('WebDAV push failed: 500 Internal Server Error')
  })
})
