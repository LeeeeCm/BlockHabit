import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AboutPanel } from './AboutPanel'
import { blueprintOrder, blueprints, plantBlueprint } from '../logic/blueprints'
import { CONTENT_VERSION } from '../logic/blueprints/manifest'
import { useAppStore } from '../store/appStore'

/**
 * C2 / D-20261110-063 §3.5.5：设置页「内容路线 / 关于」只展示事实。
 * 数字必须动态取自 blueprintOrder / manifest，不允许硬编码未来内容包或日期。
 */

let root: Root | null = null
let container: HTMLDivElement | null = null

function renderAbout(language: 'zh' | 'en'): string {
  const current = useAppStore.getState()
  useAppStore.setState({ settings: { ...current.settings, language } })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(<AboutPanel />)
  })
  return container.textContent ?? ''
}

beforeEach(() => {
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'zh' },
  })
})

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  container?.remove()
  root = null
  container = null
})

describe('AboutPanel：内容路线/关于', () => {
  it('zh：展示当前内置数量与 contentVersion（动态值）', () => {
    const text = renderAbout('zh')
    const expectedBlocks = blueprintOrder.reduce(
      (sum, id) => sum + (blueprints[id]?.blocks.length ?? 0),
      0,
    )
    expect(text).toContain(`${blueprintOrder.length} 座蓝图`)
    expect(text).toContain(`${expectedBlocks} 块积木`)
    expect(text).toContain(`contentVersion ${CONTENT_VERSION}`)
    expect(text).toContain('年度免费扩建')
    expect(text).toContain('升级说明')
    expect(text).toContain('数据与隐私')
    // 不写死未来内容包日期：只承诺年度节奏，不出现具体未来年份
    expect(text).not.toMatch(/202[6-9] 年?底|20[3-9]\d 年/)
  })

  it('en：zh/en 文案齐全', () => {
    const text = renderAbout('en')
    expect(text).toContain('blueprints')
    expect(text).toContain('blocks')
    expect(text).toContain('contentVersion')
    expect(text).toContain('Yearly free expansions')
    expect(text).toContain('Upgrading')
    expect(text).toContain('Data & privacy')
  })

  it('数量随蓝图注册表动态变化（无硬编码 18/1985）', () => {
    const extraId = '__about_test_blueprint__'
    blueprintOrder.push(extraId)
    blueprints[extraId] = { ...plantBlueprint, id: extraId, blocks: plantBlueprint.blocks.slice(0, 3) }
    try {
      const text = renderAbout('zh')
      const expectedBlocks = blueprintOrder.reduce(
        (sum, id) => sum + (blueprints[id]?.blocks.length ?? 0),
        0,
      )
      expect(text).toContain(`${blueprintOrder.length} 座蓝图`)
      expect(text).toContain(`${expectedBlocks} 块积木`)
    } finally {
      blueprintOrder.pop()
      delete blueprints[extraId]
    }
  })
})
