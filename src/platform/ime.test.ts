import { describe, expect, it } from 'vitest'
import { isImeComposing } from './ime'

describe('isImeComposing（D-20261128-135）', () => {
  it('识别原生与 React 组合态', () => {
    expect(isImeComposing({ isComposing: true })).toBe(true)
    expect(isImeComposing({ nativeEvent: { isComposing: true } })).toBe(true)
    expect(isImeComposing({ keyCode: 229 })).toBe(true)
    expect(isImeComposing({ nativeEvent: { keyCode: 229 } })).toBe(true)
  })

  it('普通 Enter 不视为组合态', () => {
    expect(isImeComposing({ isComposing: false, keyCode: 13 })).toBe(false)
    expect(isImeComposing({ nativeEvent: { isComposing: false, keyCode: 13 } })).toBe(false)
    expect(isImeComposing({})).toBe(false)
  })
})
