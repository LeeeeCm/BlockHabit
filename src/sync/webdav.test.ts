import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchRemoteState, pushRemoteState, getSyncUrl, getAuthHeaders, WebDavError } from './webdav'
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

  it('fetchRemoteState returns json text and etag on 200 OK', async () => {
    const mockJson = JSON.stringify({ schemaVersion: 2, habits: [] })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(mockJson, {
        status: 200,
        statusText: 'OK',
        headers: { ETag: '"abc123"' },
      }),
    )

    const result = await fetchRemoteState(mockConfig)
    expect(result.json).toBe(mockJson)
    expect(result.etag).toBe('"abc123"')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://dav.example.com/sync/blockhabit-data.json',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
        }),
      }),
    )
  })

  it('fetchRemoteState confirms 404 with PROPFIND (collection exists → clean initial sync)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(new Response(null, { status: 207, statusText: 'Multi-Status' }))

    const result = await fetchRemoteState(mockConfig)
    expect(result.json).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy).toHaveBeenLastCalledWith(
      'https://dav.example.com/sync/',
      expect.objectContaining({ method: 'PROPFIND', headers: expect.objectContaining({ Depth: '0' }) }),
    )
  })

  it('fetchRemoteState throws no-collection when PROPFIND also returns 404', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))

    await expect(fetchRemoteState(mockConfig)).rejects.toMatchObject({ code: 'no-collection' })
  })

  it('fetchRemoteState throws WebDavError auth on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 401, statusText: 'Unauthorized' }),
    )

    await expect(fetchRemoteState(mockConfig)).rejects.toMatchObject({ code: 'auth' })
  })

  it('pushRemoteState sends conditional PUT with If-Match when etag present', async () => {
    const mockJson = JSON.stringify({ schemaVersion: 2, habits: [] })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 204, statusText: 'No Content' }),
    )

    await pushRemoteState(mockConfig, mockJson, '"etag-1"')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://dav.example.com/sync/blockhabit-data.json',
      expect.objectContaining({
        method: 'PUT',
        body: mockJson,
        headers: expect.objectContaining({ 'If-Match': '"etag-1"' }),
      }),
    )
  })

  it('pushRemoteState retries via MKCOL when PUT returns 409 (missing parent collection)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 })) // MKCOL
      .mockResolvedValueOnce(new Response(null, { status: 201 })) // PUT retry

    await pushRemoteState(mockConfig, '{}')
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://dav.example.com/sync/',
      expect.objectContaining({ method: 'MKCOL' }),
    )
  })

  it('pushRemoteState throws conflict (412) for concurrent update', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 412 }))

    const err = await pushRemoteState(mockConfig, '{}', '"stale"').catch((e) => e)
    expect(err).toBeInstanceOf(WebDavError)
    expect(err.code).toBe('conflict')
  })

  it('pushRemoteState throws http error on 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 500, statusText: 'Internal Server Error' }),
    )

    const err = await pushRemoteState(mockConfig, '{}').catch((e) => e)
    expect(err).toBeInstanceOf(WebDavError)
    expect(err.code).toBe('http')
  })
})
