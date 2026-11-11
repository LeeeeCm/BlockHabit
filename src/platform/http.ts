/**
 * 跨平台 HTTP 取数（F4 / D-20261110-048）。
 *
 * 为什么需要它：WebDAV 走的是 WebView 的 `fetch`，标准服务器（Nextcloud 等）不返回
 * 允许跨域的 CORS 头，于是请求在 WebView 里被浏览器层直接拦掉——不是网络故障，也不是
 * 服务器拒绝，表现为 `TypeError: Failed to fetch`（见 D-20261110-024 的诚实提示）。
 * 桌面端改走 Tauri 的原生 HTTP 客户端即可绕开 WebView 的 CORS 限制；
 * 浏览器预览（`npm run dev`）没有原生能力，继续用 WebView fetch，行为与以前一致。
 */
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** WebDAV 专用取数：桌面端走原生 HTTP（无 CORS），浏览器端回落到标准 fetch */
export async function httpFetch(input: string, init?: RequestInit): Promise<Response> {
  if (isTauriRuntime()) {
    // 插件类型签名与 DOM RequestInit 略有差异，这里按结构兼容使用
    return tauriFetch(input, init as Parameters<typeof tauriFetch>[1])
  }
  return fetch(input, init)
}
