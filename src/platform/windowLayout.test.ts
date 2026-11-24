import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  WINDOW_LAYOUT_KEY,
  loadPetPosition,
  loadWindowLayout,
  savePetPosition,
  saveWindowLayout
} from './windowLayout'

beforeEach(() => localStorage.removeItem(WINDOW_LAYOUT_KEY))
afterEach(() => localStorage.removeItem(WINDOW_LAYOUT_KEY))

describe('windowLayout（D-20261124-088）', () => {
  it('读取 pet 位置并保留主窗尺寸', () => {
    localStorage.setItem(
      WINDOW_LAYOUT_KEY,
      JSON.stringify({ version: 1, main: { w: 1100, h: 760 }, pet: { x: 120, y: 80 } })
    )
    const layout = loadWindowLayout()
    expect(layout.main).toEqual({ w: 1100, h: 760 })
    expect(layout.pet).toEqual({ x: 120, y: 80 })
  })

  it('旧 mini 位置迁移为 pet（一次性）', () => {
    localStorage.setItem(WINDOW_LAYOUT_KEY, JSON.stringify({ version: 1, mini: { x: 30, y: 40 } }))
    expect(loadPetPosition()).toEqual({ x: 30, y: 40 })
  })

  it('保存 pet 不影响已有主窗尺寸', () => {
    saveWindowLayout({ version: 1, main: { w: 1000, h: 700 } })
    savePetPosition({ x: 10, y: 20 })
    const layout = loadWindowLayout()
    expect(layout.main).toEqual({ w: 1000, h: 700 })
    expect(layout.pet).toEqual({ x: 10, y: 20 })
  })

  it('损坏 JSON 时回退空布局', () => {
    localStorage.setItem(WINDOW_LAYOUT_KEY, '{bad')
    expect(loadWindowLayout()).toEqual({ version: 1 })
  })
})
