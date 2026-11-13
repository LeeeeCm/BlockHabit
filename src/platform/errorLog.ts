import packageJson from '../../package.json'

/**
 * 本地崩溃日志（A4 稳定性兜底）。
 *
 * 铁律（AGENTS §3 本地优先 + design/README.md A7）：
 * - 只写本机 localStorage，不上传、不发任何网络请求；
 * - 任何本地存储异常（隐私模式 / 配额满 / 坏 JSON）都静默降级，绝不影响应用运行。
 */

export type CrashLogKind = 'render' | 'error' | 'rejection'

export interface CrashLogEntry {
  /** ISO 时间戳，例：2026-11-10T01:42:15.000Z */
  at: string
  kind: CrashLogKind
  message: string
  stack?: string
}

/** localStorage 键（与现有 blockhabit-state / blockhabit-backup-* 命名一致） */
export const CRASH_LOG_KEY = 'blockhabit-crash-log'

/** 内存环形缓冲与本地持久化共用上限 */
export const CRASH_LOG_LIMIT = 30

/** 应用版本：取自 package.json（与 src-tauri/tauri.conf.json 的 version 同步） */
export const APP_VERSION: string = packageJson.version

const buffer: CrashLogEntry[] = []

/** 是否已从 localStorage 载入过历史日志（懒加载，避免模块导入副作用） */
let hydrated = false

/** 首次访问时合并本地历史日志；坏数据静默丢弃 */
function hydrate(): void {
  if (hydrated) return
  hydrated = true
  buffer.push(...readPersisted())
  if (buffer.length > CRASH_LOG_LIMIT) {
    buffer.splice(0, buffer.length - CRASH_LOG_LIMIT)
  }
}

function isCrashLogEntry(value: unknown): value is CrashLogEntry {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.at === 'string' &&
    (v.kind === 'render' || v.kind === 'error' || v.kind === 'rejection') &&
    typeof v.message === 'string' &&
    (v.stack === undefined || typeof v.stack === 'string')
  )
}

/** 读取持久化日志：任何异常都吞掉，返回空数组 */
function readPersisted(): CrashLogEntry[] {
  try {
    const raw = localStorage.getItem(CRASH_LOG_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCrashLogEntry).slice(-CRASH_LOG_LIMIT)
  } catch {
    return []
  }
}

/** 写入持久化日志：失败静默（仅保留内存日志） */
function persist(): void {
  try {
    localStorage.setItem(CRASH_LOG_KEY, JSON.stringify(buffer))
  } catch {
    // 本地存储不可用（隐私模式 / 配额满）时静默降级：日志只留在内存里
  }
}

/** 把任意 throw 值归一化成可读的 message + stack */
function describeError(
  error: unknown,
  fallbackMessage?: string
): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message || fallbackMessage || error.name || 'Error',
      stack: error.stack || undefined
    }
  }
  if (typeof error === 'string' && error) {
    return { message: error }
  }
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage) return { message: maybeMessage }
  }
  try {
    const text = String(error)
    if (text && text !== 'undefined' && text !== 'null') return { message: text }
  } catch {
    // String() 也可能抛（自定义 toString），走兜底文案
  }
  return { message: fallbackMessage || 'Unknown error' }
}

/**
 * 记录一条崩溃日志。
 * @param kind render（React 渲染期）/ error（window.onerror）/ rejection（unhandledrejection）
 * @param error 原始 throw 值
 * @param fallbackMessage error 无 message 时的兜底描述
 * @param extraStack 额外堆栈（如 ErrorInfo.componentStack 或 source:line:col）
 */
export function recordCrash(
  kind: CrashLogKind,
  error: unknown,
  fallbackMessage?: string,
  extraStack?: string
): CrashLogEntry {
  hydrate()
  const described = describeError(error, fallbackMessage)
  const stackParts = [described.stack, extraStack].filter(
    (part): part is string => typeof part === 'string' && part.length > 0
  )
  const entry: CrashLogEntry = {
    at: new Date().toISOString(),
    kind,
    message: described.message
  }
  if (stackParts.length > 0) entry.stack = stackParts.join('\n')

  buffer.push(entry)
  if (buffer.length > CRASH_LOG_LIMIT) {
    buffer.splice(0, buffer.length - CRASH_LOG_LIMIT)
  }
  persist()
  return entry
}

/** 读取当前内存日志快照（返回副本，避免外部改动环形缓冲） */
export function getCrashLog(): CrashLogEntry[] {
  hydrate()
  return buffer.map((entry) => ({ ...entry }))
}

/** 清空内存与本地日志（设置页/测试用）；失败静默 */
export function clearCrashLog(): void {
  buffer.length = 0
  hydrated = false
  try {
    localStorage.removeItem(CRASH_LOG_KEY)
  } catch {
    // 忽略：存储不可用时没有可清理的持久化内容
  }
}

function formatCrashEntry(entry: CrashLogEntry): string {
  const lines = [`[${entry.at}] (${entry.kind}) ${entry.message}`]
  if (entry.stack) {
    for (const line of entry.stack.split('\n')) lines.push(`  ${line}`)
  }
  return lines.join('\n')
}

/**
 * 组装纯文本诊断信息：崩溃日志 + UA + 应用版本 + 运行环境。
 * 纯本地生成，不上传；供「导出诊断信息」与人工反馈使用。
 */
export function buildDiagnosticsText(now: Date = new Date()): string {
  hydrate()
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
  const language = typeof navigator !== 'undefined' ? navigator.language : 'unknown'
  const platform = typeof navigator !== 'undefined' ? navigator.platform : 'unknown'
  const logs = buffer.length > 0 ? buffer.map(formatCrashEntry).join('\n\n') : '(empty)'
  return [
    'BlockHabit Diagnostics',
    '======================',
    `App version: ${APP_VERSION}`,
    `Generated at: ${now.toISOString()}`,
    `User agent: ${ua}`,
    `Language: ${language}`,
    `Platform: ${platform}`,
    `Crash log entries: ${buffer.length}`,
    '',
    'Crash log:',
    '----------',
    logs,
    '',
    'Generated locally by BlockHabit. No data was uploaded.'
  ].join('\n')
}

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

/**
 * 通过 Blob + 临时 <a> 触发本地下载（浏览器与 Tauri WebView 都可用）。
 * 不引入 Tauri 插件/依赖，不发起网络请求；失败静默（兜底页不能二次崩溃）。
 */
export function downloadDiagnostics(): void {
  if (typeof document === 'undefined') return
  try {
    if (typeof Blob === 'undefined' || typeof URL === 'undefined') return
    if (typeof URL.createObjectURL !== 'function') return

    const blob = new Blob([buildDiagnosticsText()], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `blockhabit-diagnostics-${timestampForFilename()}.txt`
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // 忽略：回收失败不影响用户
      }
    }, 0)
  } catch {
    // 静默：诊断导出失败时兜底界面保持可用
  }
}

let cleanupGlobalHandlers: (() => void) | null = null

/**
 * 注册全局错误捕获：window.onerror + unhandledrejection → 本地崩溃日志。
 * React 渲染期异常由 ErrorBoundary 单独记录，这里只兜住其余未捕获异常。
 * 返回卸载函数（幂等安装：重复调用返回同一个 cleanup）。
 */
export function installGlobalErrorHandlers(): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {}
  }
  if (cleanupGlobalHandlers) return cleanupGlobalHandlers

  const handleError = (event: ErrorEvent): void => {
    const source =
      event.filename && typeof event.filename === 'string'
        ? `${event.filename}:${event.lineno ?? 0}:${event.colno ?? 0}`
        : undefined
    recordCrash('error', event.error, event.message, source)
  }
  const handleRejection = (event: PromiseRejectionEvent): void => {
    recordCrash('rejection', event.reason)
  }

  window.addEventListener('error', handleError)
  window.addEventListener('unhandledrejection', handleRejection)

  const cleanup = (): void => {
    window.removeEventListener('error', handleError)
    window.removeEventListener('unhandledrejection', handleRejection)
    cleanupGlobalHandlers = null
  }
  cleanupGlobalHandlers = cleanup
  return cleanup
}
