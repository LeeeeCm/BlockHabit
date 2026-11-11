import type { Update } from '@tauri-apps/plugin-updater'

/**
 * D-20261111-069：手动检查更新适配层。
 *
 * 约束（A7 本地优先 + 数据诚实）：
 * - 只有用户显式点击才会走到这里；不做启动自动检查、不做定时检查、不静默下载。
 * - 启用条件 = 构建期开关 `VITE_UPDATER_ENABLED=1` **且** 运行在 Tauri 内。
 *   默认构建（未设置该变量）不动态 import 插件函数、不发任何网络请求。
 * - 插件按需 `import()`：浏览器预览不会把 updater 拉进主包。
 * - 插件没有暴露 abort API：取消检查只能由调用方忽略迟到结果（见 AboutPanel 的
 *   请求代次 token）。本模块不把"被忽略"伪装成"已取消"或"检查失败"。
 * - 发布端点/签名公钥由人类在 `tauri.conf.json` 的 `plugins.updater` 中配置；
 *   本文件不含任何密钥，也不内置端点。
 */

/** 检查更新的结果（判别联合，UI 只按这四种状态渲染） */
export type UpdateCheckResult =
  | { status: 'disabled' }
  | { status: 'latest'; checkedAt: Date }
  | { status: 'available'; version: string; body?: string }
  | { status: 'error'; error: UpdaterErrorInfo; checkedAt: Date }

/** 安装更新的结果（UI 可选使用；安装成功后 Windows 安装器默认重启应用） */
export type UpdateInstallResult =
  { status: 'disabled' } | { status: 'installed' } | { status: 'error'; error: UpdaterErrorInfo }

export interface UpdaterErrorInfo {
  /** 稳定的错误码，UI 不直接展示；便于日志与后续文案映射 */
  code: 'check-failed' | 'install-failed' | 'not-checked'
  /** 脱敏后的单行摘要：只保留错误类型与 message，不含栈/敏感环境信息 */
  message: string
}

/** 下载进度（字节数；contentLength 在服务端未提供时为 null） */
export interface UpdateProgress {
  downloadedBytes: number
  contentLength: number | null
}

/** 是否在 Tauri 运行时（浏览器预览 / 单测 jsdom 均为 false） */
function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * 更新通道是否启用：编译期开关 + 运行时双重判定。
 * 默认构建（未设置 VITE_UPDATER_ENABLED）恒为 false，因此 UI 显示诚实禁用态。
 */
export function isUpdaterEnabled(): boolean {
  const buildFlag = import.meta.env.VITE_UPDATER_ENABLED
  return buildFlag === '1' && isTauriRuntime()
}

/** 已发现但尚未安装的更新句柄（插件侧持有资源，需要时释放） */
let pendingUpdate: Update | null = null

/** 错误信息脱敏：单行、截断、不带栈（不把内部路径/环境写进 UI 或日志） */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name || 'Error'
    const message = error.message.replace(/\s+/g, ' ').trim().slice(0, 300)
    return message ? `${name}: ${message}` : name
  }
  if (typeof error === 'string') return error.replace(/\s+/g, ' ').trim().slice(0, 300)
  return 'Unknown error'
}

async function clearPendingUpdate(): Promise<void> {
  if (!pendingUpdate) return
  const update = pendingUpdate
  pendingUpdate = null
  try {
    await update.close()
  } catch {
    // 释放失败不影响用户（进程退出/安装后资源会由插件回收）
  }
}

/** 丢弃已发现但未安装的更新（取消检查或离开页面时调用，释放插件侧资源） */
export async function discardPendingUpdate(): Promise<void> {
  await clearPendingUpdate()
}

/**
 * 检查更新。
 * - 未启用：立即返回 disabled，**不 import 插件**、不发请求。
 * - 已是最新：latest + 检查时间。
 * - 有新版本：available(version, body?)；同时保留句柄供 installUpdate() 使用。
 * - 请求/校验失败：error（带脱敏摘要），绝不伪装成"已是最新"。
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!isUpdaterEnabled()) return { status: 'disabled' }
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()
    if (!update) {
      await clearPendingUpdate()
      return { status: 'latest', checkedAt: new Date() }
    }
    await clearPendingUpdate()
    pendingUpdate = update
    return {
      status: 'available',
      version: update.version,
      body: update.body || undefined
    }
  } catch (error) {
    await clearPendingUpdate()
    return {
      status: 'error',
      error: { code: 'check-failed', message: describeError(error) },
      checkedAt: new Date()
    }
  }
}

/**
 * 下载并安装已经检查到的更新（必须先 checkForUpdate() 得到 available）。
 * Windows：下载完成后启动安装器并退出应用（安装器默认重启应用）；
 * 其它平台：安装后需要显式 relaunch，这里按需懒加载 process 插件。
 * 进度回调仅回传字节计数，UI 可自行决定是否展示；回调异常不影响安装。
 */
export async function installUpdate(
  onProgress?: (progress: UpdateProgress) => void
): Promise<UpdateInstallResult> {
  if (!isUpdaterEnabled()) return { status: 'disabled' }
  const update = pendingUpdate
  if (!update) {
    return {
      status: 'error',
      error: {
        code: 'not-checked',
        message: 'No checked update is pending. Call checkForUpdate() first.'
      }
    }
  }

  let downloadedBytes = 0
  let contentLength: number | null = null
  const emit = (progress: UpdateProgress): void => {
    try {
      onProgress?.(progress)
    } catch {
      // 进度展示异常不应中断安装
    }
  }

  try {
    await update.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        downloadedBytes = 0
        contentLength = event.data.contentLength ?? null
      } else if (event.event === 'Progress') {
        downloadedBytes += event.data.chunkLength
      }
      emit({ downloadedBytes: contentLength ?? downloadedBytes, contentLength })
    })
    pendingUpdate = null
    // Windows 上安装器会退出当前进程（默认自动重启）；其余平台显式重启。
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch {
      // 重启失败不篡改"安装成功"的事实（Windows 安装器已负责重启）
    }
    return { status: 'installed' }
  } catch (error) {
    return {
      status: 'error',
      error: { code: 'install-failed', message: describeError(error) }
    }
  }
}
