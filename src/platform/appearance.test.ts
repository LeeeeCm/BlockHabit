import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  applyCachedAppearance,
  cacheAppearance,
  THEME_CACHE_KEY,
  LANG_CACHE_KEY
} from './appearance'

/**
 * C8：首帧外观缓存 —— 消除暗色/燕麦/雾灰主题启动时的纸白闪屏。
 */
describe('首帧外观缓存', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
    document.documentElement.removeAttribute('lang')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('写入后再读取，能还原主题与语言', () => {
    cacheAppearance('dark', 'en')
    expect(localStorage.getItem(THEME_CACHE_KEY)).toBe('dark')
    expect(localStorage.getItem(LANG_CACHE_KEY)).toBe('en')

    applyCachedAppearance()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.lang).toBe('en')
  })

  it('非法缓存值被忽略（不污染根节点）', () => {
    localStorage.setItem(THEME_CACHE_KEY, 'neon')
    localStorage.setItem(LANG_CACHE_KEY, 'fr')
    applyCachedAppearance()
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(document.documentElement.lang).toBe('')
  })

  it('localStorage 抛错时不崩溃', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => applyCachedAppearance()).not.toThrow()
  })
})
