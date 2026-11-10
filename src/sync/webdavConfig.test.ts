import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_WEBDAV_CONFIG, type WebDavConfig } from './types'
import { loadWebDavConfig, persistableWebDavConfig, saveWebDavConfig } from './useSync'

/**
 * B1：WebDAV 凭据落盘策略（rememberPassword）。
 * 关闭时密码只留在内存，localStorage 绝不包含密码；旧配置读取也要丢弃遗留密码。
 */
const KEY = 'blockhabit_webdav_config'

function rawConfig(): WebDavConfig {
  return {
    ...DEFAULT_WEBDAV_CONFIG,
    endpoint: 'https://cloud.example.com/remote.php/dav/files/me/BlockHabit/',
    username: 'me',
    password: 'app-password-123',
    enabled: true,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('WebDAV 配置落盘 / rememberPassword', () => {
  it('默认记住密码，旧配置缺少字段时视为 true', () => {
    expect(DEFAULT_WEBDAV_CONFIG.rememberPassword).toBe(true)
    localStorage.setItem(KEY, JSON.stringify({ ...rawConfig(), rememberPassword: undefined }))
    const loaded = loadWebDavConfig()
    expect(loaded.rememberPassword).toBe(true)
    expect(loaded.password).toBe('app-password-123')
  })

  it('rememberPassword=true 时密码随配置落盘', () => {
    saveWebDavConfig(rawConfig())
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    expect(stored.password).toBe('app-password-123')
  })

  it('rememberPassword=false 时 localStorage 不含密码，但保留开关与其它字段', () => {
    const config: WebDavConfig = { ...rawConfig(), rememberPassword: false }
    saveWebDavConfig(config)
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    expect(stored.password).toBe('')
    expect(stored.rememberPassword).toBe(false)
    expect(stored.endpoint).toBe(config.endpoint)
    expect(stored.username).toBe('me')
    expect((localStorage.getItem(KEY) ?? '').includes('app-password-123')).toBe(false)
  })

  it('读取旧配置时若已关闭记住密码，则丢弃磁盘上的遗留密码', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...rawConfig(), rememberPassword: false, password: 'legacy-password' }),
    )
    const loaded = loadWebDavConfig()
    expect(loaded.rememberPassword).toBe(false)
    expect(loaded.password).toBe('')
  })

  it('persistableWebDavConfig 是纯函数且不改原对象', () => {
    const config: WebDavConfig = { ...rawConfig(), rememberPassword: false }
    const persisted = persistableWebDavConfig(config)
    expect(persisted.password).toBe('')
    expect(config.password).toBe('app-password-123')
    expect(persistableWebDavConfig({ ...rawConfig(), rememberPassword: true }).password).toBe(
      'app-password-123',
    )
  })
})
