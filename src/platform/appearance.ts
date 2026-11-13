import type { Language, Theme } from '../types'

/** 首帧外观缓存键（与存档 STATE_KEY 无关，纯粹是「绘制提示」） */
export const THEME_CACHE_KEY = 'blockhabit-theme'
export const LANG_CACHE_KEY = 'blockhabit-lang'

const THEMES: readonly Theme[] = ['light', 'dark', 'oat', 'fog']
const LANGS: readonly Language[] = ['zh', 'en']

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 隐私模式 / 配额 / 策略禁用：缓存只是绘制提示，失败无碍
  }
}

/**
 * 首帧外观（C8）：存档是异步读的（Tauri 走文件），React 首帧必然拿不到 settings.theme。
 * 用上次写入的缓存主题/语言先把根节点属性摆正，避免暗色/燕麦/雾灰主题启动时闪一下纸白。
 * 缓存只是绘制提示，真值仍以存档为准（App 的 effect 会立刻覆盖并回写）。
 */
export function applyCachedAppearance(
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined
): void {
  if (!doc) return
  const theme = safeGet(THEME_CACHE_KEY)
  if (theme && (THEMES as readonly string[]).includes(theme)) {
    doc.documentElement.dataset.theme = theme
  }
  const lang = safeGet(LANG_CACHE_KEY)
  if (lang && (LANGS as readonly string[]).includes(lang)) {
    doc.documentElement.lang = lang
  }
}

/** 主题/语言变化时回写缓存，供下次启动的首帧使用 */
export function cacheAppearance(theme: Theme, lang: Language): void {
  safeSet(THEME_CACHE_KEY, theme)
  safeSet(LANG_CACHE_KEY, lang)
}
