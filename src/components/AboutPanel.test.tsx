import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AboutPanel } from './AboutPanel'
import { blueprintOrder, blueprints, plantBlueprint } from '../logic/blueprints'
import { CONTENT_VERSION } from '../logic/blueprints/manifest'
import { APP_VERSION } from '../platform/errorLog'
import { useAppStore } from '../store/appStore'
import type { UpdateCheckResult } from '../platform/updater'

/**
 * C2 / D-20261110-063 §3.5.5：设置页「内容路线 / 关于」只展示事实。
 * 数字必须动态取自 blueprintOrder / manifest，不允许硬编码未来内容包或日期。
 *
 * D-20261111-069：追加「版本与更新」行状态用例。适配层整体 mock，
 * 以便在 jsdom（非 Tauri）里驱动 enabled/latest/available/error/取消 分支。
 */

const updaterMock = vi.hoisted(() => ({
  enabled: false,
  check: vi.fn(),
  install: vi.fn(),
  discard: vi.fn()
}))

vi.mock('../platform/updater', () => ({
  isUpdaterEnabled: () => updaterMock.enabled,
  checkForUpdate: updaterMock.check,
  installUpdate: updaterMock.install,
  discardPendingUpdate: updaterMock.discard
}))

let root: Root | null = null
let container: HTMLDivElement | null = null

function renderAboutNode(language: 'zh' | 'en'): HTMLDivElement {
  const current = useAppStore.getState()
  useAppStore.setState({ settings: { ...current.settings, language } })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(<AboutPanel />)
  })
  return container
}

function renderAbout(language: 'zh' | 'en'): string {
  return renderAboutNode(language).textContent ?? ''
}

function findButton(node: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(node.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === label
  )
}

beforeEach(() => {
  updaterMock.enabled = false
  updaterMock.check.mockReset()
  updaterMock.install.mockReset().mockResolvedValue({ status: 'installed' })
  updaterMock.discard.mockReset().mockResolvedValue(undefined)
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'zh' }
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
      0
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
        0
      )
      expect(text).toContain(`${blueprintOrder.length} 座蓝图`)
      expect(text).toContain(`${expectedBlocks} 块积木`)
    } finally {
      blueprintOrder.pop()
      delete blueprints[extraId]
    }
  })
})

describe('AboutPanel：版本与更新（D-20261111-069）', () => {
  it('未启用发布链路：显示当前版本与诚实禁用说明，点击不发请求', () => {
    updaterMock.enabled = false
    const node = renderAboutNode('zh')
    const text = node.textContent ?? ''

    expect(text).toContain('版本与更新')
    expect(text).toContain(`当前版本 ${APP_VERSION}`)
    expect(text).toContain('发布链路尚未启用')

    const button = findButton(node, '检查更新')
    expect(button).toBeDefined()
    expect(button?.disabled).toBe(true)
    act(() => {
      button?.click()
    })
    expect(updaterMock.check).not.toHaveBeenCalled()
  })

  it('en：未启用文案齐全', () => {
    const text = renderAbout('en')
    expect(text).toContain('Version & updates')
    expect(text).toContain(`Current version ${APP_VERSION}`)
    expect(text).toContain('Update channel is not configured yet')
  })

  it('点击检查 → 已是最新，显示检查时间', async () => {
    updaterMock.enabled = true
    updaterMock.check.mockResolvedValue({
      status: 'latest',
      checkedAt: new Date(2026, 10, 11, 9, 5)
    } satisfies UpdateCheckResult)
    const node = renderAboutNode('zh')

    await act(async () => {
      findButton(node, '检查更新')?.click()
    })

    const text = node.textContent ?? ''
    expect(updaterMock.check).toHaveBeenCalledTimes(1)
    expect(text).toContain('已是最新版本')
    expect(text).toContain('上次检查')
    expect(findButton(node, '检查更新')?.disabled).toBe(false)
  })

  it('点击检查 → 发现新版本，可下载并安装', async () => {
    updaterMock.enabled = true
    updaterMock.check.mockResolvedValue({
      status: 'available',
      version: '0.3.0',
      body: 'Release notes v0.3.0'
    } satisfies UpdateCheckResult)
    const node = renderAboutNode('zh')

    await act(async () => {
      findButton(node, '检查更新')?.click()
    })
    expect(node.textContent).toContain('发现新版本 0.3.0')
    expect(node.textContent).toContain('Release notes v0.3.0')

    await act(async () => {
      findButton(node, '下载并安装')?.click()
    })
    expect(updaterMock.install).toHaveBeenCalledTimes(1)
  })

  it('点击检查失败 → 显示失败，不伪装成已是最新', async () => {
    updaterMock.enabled = true
    updaterMock.check.mockResolvedValue({
      status: 'error',
      error: { code: 'check-failed', message: 'Error: boom' },
      checkedAt: new Date()
    } satisfies UpdateCheckResult)
    const node = renderAboutNode('zh')

    await act(async () => {
      findButton(node, '检查更新')?.click()
    })

    const text = node.textContent ?? ''
    expect(text).toContain('检查失败')
    expect(text).not.toContain('已是最新版本')
    expect(findButton(node, '检查更新')?.disabled).toBe(false)
  })

  it('取消检查：忽略迟到结果，不误报失败', async () => {
    updaterMock.enabled = true
    let resolveCheck: ((value: UpdateCheckResult) => void) | undefined
    updaterMock.check.mockReturnValue(
      new Promise<UpdateCheckResult>((resolve) => {
        resolveCheck = resolve
      })
    )
    const node = renderAboutNode('zh')

    await act(async () => {
      findButton(node, '检查更新')?.click()
    })
    expect(node.textContent).toContain('检查中')

    act(() => {
      findButton(node, '取消')?.click()
    })
    expect(findButton(node, '检查更新')?.disabled).toBe(false)

    // 插件请求无法真正中止：迟到结果按代次丢弃，UI 不得显示失败
    await act(async () => {
      resolveCheck?.({
        status: 'error',
        error: { code: 'check-failed', message: 'Error: late' },
        checkedAt: new Date()
      })
      await Promise.resolve()
    })
    const text = node.textContent ?? ''
    expect(text).not.toContain('检查失败')
    expect(findButton(node, '检查更新')?.disabled).toBe(false)
  })
})
