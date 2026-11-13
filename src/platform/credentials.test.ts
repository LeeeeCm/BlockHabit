import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetCredentialStoreForTests,
  credentialAccount,
  credentialStoreState,
  getCredential,
  isOsCredentialStoreReady,
  probeCredentialStore,
  removeCredential,
  setCredential,
} from './credentials'

/**
 * C4 §4 方案 B 的适配层契约（jsdom = 浏览器预览环境，没有 __TAURI_INTERNALS__）：
 * - 不可用时如实返回 false/null，绝不假装写成功；
 * - 账号键是 sha256 十六进制，且用换行分隔端点与用户名（避免拼接歧义撞键）；
 * - 密码只在参数里流动，不进错误/日志。
 */

beforeEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  __resetCredentialStoreForTests()
})

describe('credentials：浏览器预览（无 OS 凭据存储）', () => {
  it('探测返回 false，并缓存为 unavailable', async () => {
    expect(credentialStoreState()).toBe('unknown')
    expect(await probeCredentialStore()).toBe(false)
    expect(isOsCredentialStoreReady()).toBe(false)
    expect(credentialStoreState()).toBe('unavailable')
  })

  it('读/写/删一律不谎报成功（不调用任何 Tauri 命令）', async () => {
    expect(await getCredential('acct')).toBeNull()
    expect(await setCredential('acct', 'secret')).toBe(false)
    expect(await removeCredential('acct')).toBe(false)
  })
})

describe('credentials：账号键派生', () => {
  it('输出 64 位十六进制（sha256）且同输入稳定', async () => {
    const a = await credentialAccount('https://dav.example.com', 'lee')
    const b = await credentialAccount('https://dav.example.com', 'lee')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).toBe(b)
  })

  it('端点/用户名任一不同则键不同', async () => {
    const base = await credentialAccount('https://a.example.com', 'lee')
    const otherEndpoint = await credentialAccount('https://b.example.com', 'lee')
    const otherUser = await credentialAccount('https://a.example.com', 'lee2')
    expect(base).not.toBe(otherEndpoint)
    expect(base).not.toBe(otherUser)
  })

  it('用换行分隔避免拼接歧义（a+bc 与 ab+c 不得撞键）', async () => {
    const left = await credentialAccount('a', 'bc')
    const right = await credentialAccount('ab', 'c')
    expect(left).not.toBe(right)
  })

  it('两端空白被裁剪（表单粘贴多一个空格不换条目）', async () => {
    const trimmed = await credentialAccount('https://dav.example.com', 'lee')
    const padded = await credentialAccount('  https://dav.example.com  ', ' lee ')
    expect(padded).toBe(trimmed)
  })
})
