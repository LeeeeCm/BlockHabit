import { sha256Hex, utf8Encode } from '../storage/archiveZip'

/**
 * C4 §4 方案 B：OS 凭据管理器（Windows Credential Manager）适配层。
 *
 * 约束（A7 本地优先 + 数据诚实）：
 * - 只有桌面端（Tauri）且有 OS 存储时才走这个通道；浏览器预览 / jsdom 一律「不可用」，
 *   调用方据此回退到原有 localStorage 行为，绝不因为引入 keyring 而让同步用不了。
 * - 密码只在「写入 / 读取」两个瞬间经过这里，不进 console、不进错误消息、不进存档。
 * - 账号键不落明文身份：由调用方用 sha256(endpoint + 换行 + username) 十六进制派生，
 *   凭据管理器里看不到你的邮箱或服务器地址。
 * - 命令按需动态 import：浏览器构建不会把 @tauri-apps/api 拉进主路径。
 */

/** 模块级探测结果缓存：unknown = 还没探过；available/unavailable = 上次探测结论 */
export type CredentialStoreState = 'unknown' | 'available' | 'unavailable'

let storeState: CredentialStoreState = 'unknown'

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** 上次探测结论（同步读取；UI 用它决定提示文案） */
export function credentialStoreState(): CredentialStoreState {
  return storeState
}

/** OS 凭据存储是否已确认可用（同步视图，供 persistableXxx 之类的同步路径使用） */
export function isOsCredentialStoreReady(): boolean {
  return storeState === 'available'
}

/** 仅测试使用：清空探测缓存，让每个用例从 unknown 开始 */
export function __resetCredentialStoreForTests(): void {
  storeState = 'unknown'
}

async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

/**
 * 探测 OS 凭据存储是否可用（只读探测，不写任何凭据）。
 * 结果缓存在模块级：配置落盘是同步路径，需要同步读到结论。
 */
export async function probeCredentialStore(): Promise<boolean> {
  if (!isTauriRuntime()) {
    storeState = 'unavailable'
    return false
  }
  try {
    const ok = await invokeCommand<boolean>('credential_available')
    storeState = ok ? 'available' : 'unavailable'
    return ok
  } catch {
    storeState = 'unavailable'
    return false
  }
}

/**
 * 凭据账号键：sha256(endpoint + '\n' + username) 的十六进制。
 * 用换行分隔是为了让「a.example + bc」与「a + examplebc」不会撞成同一个键。
 */
export async function credentialAccount(endpoint: string, username: string): Promise<string> {
  const normalized = `${(endpoint ?? '').trim()}\n${(username ?? '').trim()}`
  return sha256Hex(utf8Encode(normalized))
}

/** 读取密码；没有条目或存储不可用都返回 null（调用方提示重输，绝不阻塞启动） */
export async function getCredential(account: string): Promise<string | null> {
  if (!isOsCredentialStoreReady()) return null
  try {
    const secret = await invokeCommand<string | null>('credential_get', { account })
    return secret && secret.length > 0 ? secret : null
  } catch {
    return null
  }
}

/** 写入密码；返回是否确认写成功（失败时调用方保留旧行为，不谎报已保存） */
export async function setCredential(account: string, secret: string): Promise<boolean> {
  if (!isOsCredentialStoreReady() || !secret) return false
  try {
    await invokeCommand<void>('credential_set', { account, secret })
    return true
  } catch {
    return false
  }
}

/** 删除密码；幂等（条目本来就不存在也算成功） */
export async function removeCredential(account: string): Promise<boolean> {
  if (!isOsCredentialStoreReady()) return false
  try {
    await invokeCommand<boolean>('credential_delete', { account })
    return true
  } catch {
    return false
  }
}
