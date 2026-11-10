import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GUIDE_TIPS_KEY, hasSeenTip, markTipSeen, resetGuideTips } from './guideTips'

/**
 * D-20261110-054：页面提示已读状态。
 *
 * 存储只是「提示看过没有」的界面状态：坏档 / 隐私模式都不能让页面崩，
 * 最坏结果只能是提示再看一次。
 */
describe('guideTips 页面提示已读状态', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('首次进入：三个提示都未看过', () => {
    expect(hasSeenTip('build')).toBe(false)
    expect(hasSeenTip('showcase')).toBe(false)
    expect(hasSeenTip('stats')).toBe(false)
  })

  it('标记后为已看过，且不影响其他页提示', () => {
    markTipSeen('build')
    expect(hasSeenTip('build')).toBe(true)
    expect(hasSeenTip('showcase')).toBe(false)
    expect(JSON.parse(localStorage.getItem(GUIDE_TIPS_KEY) ?? 'null')).toEqual(['build'])
  })

  it('重复标记不产生重复项', () => {
    markTipSeen('build')
    markTipSeen('build')
    expect(JSON.parse(localStorage.getItem(GUIDE_TIPS_KEY) ?? 'null')).toEqual(['build'])
  })

  it('reset 后重新视为未看过', () => {
    markTipSeen('build')
    markTipSeen('showcase')
    resetGuideTips()
    expect(hasSeenTip('build')).toBe(false)
    expect(hasSeenTip('showcase')).toBe(false)
    expect(hasSeenTip('stats')).toBe(false)
    expect(localStorage.getItem(GUIDE_TIPS_KEY)).toBeNull()
  })

  it('坏 JSON 按未看过处理，后续写入自动修复', () => {
    localStorage.setItem(GUIDE_TIPS_KEY, '{not-json')
    expect(hasSeenTip('build')).toBe(false)
    markTipSeen('build')
    expect(hasSeenTip('build')).toBe(true)
    expect(JSON.parse(localStorage.getItem(GUIDE_TIPS_KEY) ?? 'null')).toEqual(['build'])
  })

  it('JSON 合法但非数组 / 含未知 id 时过滤，保留已知项', () => {
    localStorage.setItem(GUIDE_TIPS_KEY, '"build"')
    expect(hasSeenTip('build')).toBe(false)

    localStorage.setItem(GUIDE_TIPS_KEY, JSON.stringify(['build', 'bogus', 42, null]))
    expect(hasSeenTip('build')).toBe(true)
    expect(hasSeenTip('stats')).toBe(false)

    markTipSeen('stats')
    expect(JSON.parse(localStorage.getItem(GUIDE_TIPS_KEY) ?? 'null')).toEqual(['build', 'stats'])
  })

  it('读取抛异常时按未看过处理，不崩溃', () => {
    markTipSeen('build')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(hasSeenTip('build')).toBe(false)
  })

  it('写入抛异常时静默忽略，不崩溃', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => markTipSeen('build')).not.toThrow()
  })

  it('删除抛异常时静默忽略，不崩溃', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => resetGuideTips()).not.toThrow()
  })

  it('localStorage 整体不可用时降级为未看过', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(hasSeenTip('build')).toBe(false)
    expect(() => markTipSeen('build')).not.toThrow()
    expect(() => resetGuideTips()).not.toThrow()
  })
})
