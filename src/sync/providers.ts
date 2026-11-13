/**
 * A3 / D-20261110-061：WebDAV 服务商预设（纯数据 + 纯函数）。
 *
 * 为什么单独成模块：预设只是「服务商 → endpoint 生成规则」的映射，不碰网络、不碰 React，
 * 便于单测覆盖 URL 拼接、协议补全与用户名编码；诊断（diagnose.ts）只消费生成后的集合 URL。
 *
 * 设计约束（deep-dive §3.3.3）：
 * - 只存「服务商 id + base + username」，不存密码副本；
 * - 切换服务商时旧 endpoint 不得泄漏（由 switchProvider 重建）；
 * - 预设不联网、不探测服务商。
 */

export type ProviderId = 'nextcloud' | 'jianguoyun' | 'synology' | 'generic'

/** 坚果云 WebDAV 固定入口（不依赖用户填写服务器地址） */
export const JIANGUOYUN_ENDPOINT = 'https://dav.jianguoyun.com/dav/BlockHabit/'

/** Nextcloud 的用户目录路径前缀 */
export const NEXTCLOUD_DAV_PREFIX = '/remote.php/dav/files/'

/** 群晖 WebDAV 套件默认的共享目录路径 */
export const SYNOLOGY_DAV_PATH = '/home/BlockHabit/'

/** 新建目录时使用的固定文件夹名（与各预设路径后缀一致） */
export const BLOCKHABIT_FOLDER = 'BlockHabit'

export interface ProviderPreset {
  id: ProviderId
  /** 是否需要用户填写「服务器地址」（false = 固定域名，如坚果云） */
  requiresServer: boolean
  /** 是否应提示「用应用专用密码」（2FA 服务商；仅用于 UI 文案） */
  requiresAppPassword: boolean
  /** i18n 文案键（逻辑层不持有文案） */
  nameKey: string
  hintKey: string
  /** 由 base + username 生成集合 URL（以 / 结尾）；信息不足时返回 '' */
  buildEndpoint(input: { base: string; username: string }): string
}

/** 设置页展示顺序 */
export const PROVIDER_ORDER: ProviderId[] = ['nextcloud', 'jianguoyun', 'synology', 'generic']

/**
 * 规范化服务器地址：
 * - 补全协议（无协议 / 协议相对 // 一律补 https://）；
 * - 去掉 query / hash（服务器地址只应是 scheme + host + path）；
 * - 协议小写、合并重复斜杠、去掉尾部斜杠。
 */
export function normalizeServerBase(input: string): string {
  let value = String(input ?? '').trim()
  if (!value) return ''
  // 协议相对地址：//dav.example.com → https://dav.example.com
  if (value.startsWith('//')) value = `https:${value}`
  // 服务器地址不应携带 query / hash
  value = value.replace(/[?#].*$/, '')
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`
  // 协议统一小写
  value = value.replace(
    /^([a-z][a-z0-9+.-]*):\/\//i,
    (_match, scheme: string) => `${scheme.toLowerCase()}://`
  )
  // 去掉尾部斜杠，并把路径中的重复斜杠合并（保留 scheme 后的 //）
  value = value.replace(/\/+$/, '').replace(/([^:])\/{2,}/g, '$1/')
  // 只有协议、没有主机（如 "https://"）视为空
  if (!/^[a-z][a-z0-9+.-]*:\/\/.+/i.test(value)) return ''
  return value
}

/** base 去掉尾部斜杠（空串返回空串） */
function trimBase(base: string): string {
  return normalizeServerBase(base).replace(/\/+$/, '')
}

/** 拼接 base + 固定路径（path 以 / 开头）；base 为空时返回 '' */
function joinBaseAndPath(base: string, path: string): string {
  const normalized = trimBase(base)
  if (!normalized) return ''
  return `${normalized}${path}`
}

function nextcloudEndpoint({ base, username }: { base: string; username: string }): string {
  const user = String(username ?? '').trim()
  const prefix = joinBaseAndPath(base, NEXTCLOUD_DAV_PREFIX)
  // Nextcloud 的端点必须同时有服务器地址与用户名才有意义
  if (!prefix || !user) return ''
  return `${prefix}${encodeURIComponent(user)}/${BLOCKHABIT_FOLDER}/`
}

function jianguoyunEndpoint(): string {
  return JIANGUOYUN_ENDPOINT
}

function synologyEndpoint({ base }: { base: string; username: string }): string {
  return joinBaseAndPath(base, SYNOLOGY_DAV_PATH)
}

function genericEndpoint({ base }: { base: string; username: string }): string {
  const normalized = trimBase(base)
  if (!normalized) return ''
  return `${normalized}/`
}

export const PROVIDER_PRESETS: Record<ProviderId, ProviderPreset> = {
  nextcloud: {
    id: 'nextcloud',
    requiresServer: true,
    requiresAppPassword: true,
    nameKey: 'settings.webdav.providers.nextcloud',
    hintKey: 'settings.webdav.providerHints.nextcloud',
    buildEndpoint: nextcloudEndpoint
  },
  jianguoyun: {
    id: 'jianguoyun',
    requiresServer: false,
    requiresAppPassword: true,
    nameKey: 'settings.webdav.providers.jianguoyun',
    hintKey: 'settings.webdav.providerHints.jianguoyun',
    buildEndpoint: () => jianguoyunEndpoint()
  },
  synology: {
    id: 'synology',
    requiresServer: true,
    requiresAppPassword: false,
    nameKey: 'settings.webdav.providers.synology',
    hintKey: 'settings.webdav.providerHints.synology',
    buildEndpoint: synologyEndpoint
  },
  generic: {
    id: 'generic',
    requiresServer: true,
    requiresAppPassword: false,
    nameKey: 'settings.webdav.providers.generic',
    hintKey: 'settings.webdav.providerHints.generic',
    buildEndpoint: genericEndpoint
  }
}

/** 按服务商生成集合 URL；未知 id 或信息不足时返回 '' */
export function buildEndpoint(providerId: ProviderId, base: string, username: string): string {
  const preset = PROVIDER_PRESETS[providerId]
  if (!preset) return ''
  return preset.buildEndpoint({ base: String(base ?? ''), username: String(username ?? '') })
}

/**
 * 切换服务商时的表单状态迁移。
 *
 * 关键行为：**旧 endpoint 永不沿用**——一律由 base + username 重新生成；
 * 生成不出来（例如切到需要服务器地址的预设但 base 为空）就清空，
 * 避免「看起来切到了新服务商，实际还在连旧地址」。
 */
export interface ProviderSwitchState {
  providerId: ProviderId
  base: string
  username: string
  endpoint: string
}

export function switchProvider(
  current: ProviderSwitchState,
  nextId: ProviderId
): ProviderSwitchState {
  if (!PROVIDER_PRESETS[nextId]) return { ...current }
  // 坚果云使用固定域名，base 没有意义（清掉避免残留在表单里）
  const base = nextId === 'jianguoyun' ? '' : current.base
  return {
    providerId: nextId,
    base,
    username: current.username,
    endpoint: buildEndpoint(nextId, base, current.username)
  }
}
