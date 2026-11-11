import { describe, it, expect, vi, afterEach } from 'vitest'
import { prefersReducedMotion } from './dom'

/**
 * C1：系统「减少动态效果」偏好的读取。canvas 动画据此降级为瞬时落位。
 */
describe('prefersReducedMotion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('系统开启减少动态时返回 true', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }))
    expect(prefersReducedMotion()).toBe(true)
  })

  it('系统未开启时返回 false', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, media: '' }))
    expect(prefersReducedMotion()).toBe(false)
  })

  it('matchMedia 不可用或抛错时安全退化为 false', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersReducedMotion()).toBe(false)
    vi.stubGlobal('matchMedia', () => {
      throw new Error('boom')
    })
    expect(prefersReducedMotion()).toBe(false)
  })
})
