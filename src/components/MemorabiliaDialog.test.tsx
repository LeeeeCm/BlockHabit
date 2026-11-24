import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemorabiliaDialog } from './MemorabiliaDialog'
import { useAppStore } from '../store/appStore'
import { blueprintOrder } from '../logic/blueprints'

vi.mock('./MonthlyPosterModal', () => ({
  MonthlyPosterModal: () => <div data-testid="poster-modal" />
}))
vi.mock('./YearbookModal', () => ({
  YearbookModal: () => <div data-testid="yearbook-modal" />
}))
vi.mock('./BuildingArchiveModal', () => ({
  BuildingArchiveModal: (props: { blueprintId: string }) => (
    <div data-testid="archive-modal">{props.blueprintId}</div>
  )
}))
vi.mock('./PolaroidModal', () => ({
  PolaroidModal: (props: { blueprint: { id: string } }) => (
    <div data-testid="polaroid-modal">{props.blueprint.id}</div>
  )
}))
vi.mock('./ArchiveExportPanel', () => ({
  ArchiveExportPanel: () => <div data-testid="archive-export" />
}))

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLDivElement | null = null

function render(completed: string[] = []): HTMLDivElement {
  useAppStore.setState({
    completedBlueprintIds: completed,
    settings: { ...useAppStore.getState().settings, language: 'zh' }
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(<MemorabiliaDialog onClose={vi.fn()} />)
  })
  return container
}

function clickByText(target: HTMLElement, text: string): void {
  const button = Array.from(target.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(text)
  )
  if (!button) throw new Error(`button not found: ${text}`)
  act(() => button.click())
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: () => ({
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  })
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container?.remove()
  container = null
})

describe('纪念品中心（D-20261124-084）', () => {
  it('聚合画报、年鉴、建筑档案、拍立得与完整档案包', () => {
    const first = blueprintOrder[0]
    const view = render([first])
    const text = view.textContent ?? ''
    expect(text).toContain('纪念品与导出')
    expect(text).toContain('月度画报')
    expect(text).toContain('年鉴')
    expect(text).toContain('建筑档案与相纸')
    expect(view.querySelector('[data-testid="archive-export"]')).not.toBeNull()
    expect(view.querySelector('[aria-haspopup="listbox"]')).not.toBeNull()
  })

  it('打开画报走既有弹层', () => {
    const view = render([blueprintOrder[0]])
    clickByText(view, '月度画报')
    expect(view.querySelector('[data-testid="poster-modal"]')).not.toBeNull()
  })

  it('选中的建筑可打开档案与拍立得', () => {
    const first = blueprintOrder[0]
    const view = render([first])
    clickByText(view, '打开档案')
    expect(view.querySelector('[data-testid="archive-modal"]')?.textContent).toBe(first)
  })

  it('没有落成建筑时如实显示空态，不生成假条目', () => {
    const view = render([])
    expect(view.textContent).toContain('还没有落成的建筑')
    expect(view.querySelector('[aria-haspopup="listbox"]')).toBeNull()
  })
})
